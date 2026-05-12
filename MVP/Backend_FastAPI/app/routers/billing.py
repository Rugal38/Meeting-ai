import logging
from datetime import datetime

import stripe as stripe_lib
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.core.usage import reset_usage_for_period
from app.database import SessionLocal, get_db
from app.models import User
from app.schemas import (
    BillingStatusOut, CheckoutRequest, CheckoutResponse, PortalResponse,
)
from app.services.stripe_service import get_stripe, price_to_plan

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/billing", tags=["billing"])

@router.get("/status", response_model=BillingStatusOut)
def get_billing_status(current_user: User = Depends(get_current_user)):
    return BillingStatusOut(
        plan_tier=current_user.plan_tier or "free",
        subscription_status=current_user.subscription_status or "active",
        current_period_end=current_user.current_period_end,
        has_stripe_customer=bool(current_user.stripe_customer_id),
    )


@router.post("/create-checkout-session", response_model=CheckoutResponse)
@limiter.limit("10/minute")
def create_checkout_session(
    request: Request,
    body: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing is not configured")

    # Evaluated at request time so env changes after startup are picked up
    allowed = {settings.stripe_pro_price_id, settings.stripe_business_price_id} - {""}
    if not allowed:
        raise HTTPException(status_code=503, detail="Stripe price IDs are not configured")
    if body.price_id not in allowed:
        logger.error(
            "Invalid price_id received: %r — allowed: %r", body.price_id, allowed
        )
        raise HTTPException(status_code=400, detail="Invalid price ID")

    s = get_stripe()

    try:
        if not current_user.stripe_customer_id:
            customer = s.Customer.create(email=current_user.email, name=current_user.nom)
            current_user.stripe_customer_id = customer.id
            db.commit()

        session = s.checkout.Session.create(
            customer=current_user.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{"price": body.price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{settings.frontend_url}/billing?success=true",
            cancel_url=f"{settings.frontend_url}/billing?canceled=true",
        )
    except Exception as exc:
        logger.error("Stripe checkout error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc}")

    return CheckoutResponse(checkout_url=session.url)


@router.post("/create-portal-session", response_model=PortalResponse)
@limiter.limit("10/minute")
def create_portal_session(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing is not configured")
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    s = get_stripe()
    session = s.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=f"{settings.frontend_url}/billing",
    )
    return PortalResponse(portal_url=session.url)


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook — no JWT auth, validated via HMAC signature."""
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe_lib.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe_lib.error.SignatureVerificationError:
        logger.warning("Invalid Stripe webhook signature")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    except Exception as exc:
        logger.error("Webhook parse error: %s", exc)
        raise HTTPException(status_code=400, detail="Bad webhook payload")

    db: Session = SessionLocal()
    try:
        _handle_event(event, db)
    except Exception as exc:
        logger.exception("Webhook handler error for %s: %s", event.type, exc)
        db.rollback()
    finally:
        db.close()

    return {"received": True}


# ── Event handlers ────────────────────────────────────────────────────────────

def _handle_event(event: dict, db: Session) -> None:
    etype = event["type"]

    if etype == "checkout.session.completed":
        _on_checkout_completed(event["data"]["object"], db)

    elif etype == "customer.subscription.updated":
        _on_subscription_updated(event["data"]["object"], db)

    elif etype == "customer.subscription.deleted":
        _on_subscription_deleted(event["data"]["object"], db)

    elif etype == "invoice.payment_failed":
        _on_payment_failed(event["data"]["object"], db)

    elif etype == "invoice.payment_succeeded":
        _on_payment_succeeded(event["data"]["object"], db)

    else:
        logger.debug("Unhandled Stripe event: %s", etype)


def _on_checkout_completed(session: dict, db: Session) -> None:
    if session.get("mode") != "subscription":
        return
    customer_id   = session.get("customer")
    subscription_id = session.get("subscription")
    if not customer_id or not subscription_id:
        return

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        return

    s = get_stripe()
    subscription = s.Subscription.retrieve(subscription_id)
    price_id = subscription.items.data[0].price.id
    plan = price_to_plan(price_id)

    user.stripe_subscription_id = subscription_id
    user.plan_tier              = plan
    user.subscription_status    = "active"
    user.current_period_end     = datetime.fromtimestamp(subscription.current_period_end)
    db.commit()
    logger.info("Activated %s plan for user %s", plan, user.email)


def _on_subscription_updated(subscription: dict, db: Session) -> None:
    user = db.query(User).filter(User.stripe_subscription_id == subscription["id"]).first()
    if not user:
        return
    price_id = subscription["items"]["data"][0]["price"]["id"]
    plan = price_to_plan(price_id)
    user.plan_tier           = plan
    user.subscription_status = subscription["status"]
    user.current_period_end  = datetime.fromtimestamp(subscription["current_period_end"])
    db.commit()
    logger.info("Updated plan to %s for user %s", plan, user.email)


def _on_subscription_deleted(subscription: dict, db: Session) -> None:
    user = db.query(User).filter(User.stripe_subscription_id == subscription["id"]).first()
    if not user:
        return
    user.plan_tier              = "free"
    user.subscription_status    = "canceled"
    user.stripe_subscription_id = None
    db.commit()
    logger.info("Downgraded to free: %s", user.email)


def _on_payment_failed(invoice: dict, db: Session) -> None:
    user = db.query(User).filter(User.stripe_customer_id == invoice["customer"]).first()
    if user:
        user.subscription_status = "past_due"
        db.commit()
        logger.warning("Payment failed for user %s", user.email)


def _on_payment_succeeded(invoice: dict, db: Session) -> None:
    if invoice.get("billing_reason") not in ("subscription_cycle", "subscription_update"):
        return
    user = db.query(User).filter(User.stripe_customer_id == invoice["customer"]).first()
    if not user or not user.stripe_subscription_id:
        return

    s = get_stripe()
    try:
        subscription = s.Subscription.retrieve(user.stripe_subscription_id)
        period_start = datetime.fromtimestamp(subscription.current_period_start)
        period_end   = datetime.fromtimestamp(subscription.current_period_end)
    except Exception:
        return

    user.subscription_status = "active"
    user.current_period_end  = period_end
    reset_usage_for_period(user, period_start, period_end, db)
    db.commit()
    logger.info("Reset usage for %s after successful payment", user.email)
