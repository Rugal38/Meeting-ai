"""Thin wrapper around Stripe SDK — initialises api_key from settings."""
import stripe

from app.core.config import settings


def get_stripe() -> stripe:
    if not settings.stripe_secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = settings.stripe_secret_key
    return stripe


def price_to_plan(price_id: str) -> str:
    """Map a Stripe price ID to a plan tier string."""
    if price_id == settings.stripe_pro_price_id:
        return "pro"
    if price_id == settings.stripe_business_price_id:
        return "business"
    return "free"


def get_or_create_customer(email: str, name: str | None = None) -> str:
    """Return existing customer_id or create a new Stripe customer."""
    s = get_stripe()
    customers = s.Customer.list(email=email, limit=1)
    if customers.data:
        return customers.data[0].id
    customer = s.Customer.create(email=email, name=name or email)
    return customer.id


def calculate_mrr() -> float:
    """Sum MRR from all active monthly subscriptions via Stripe API."""
    s = get_stripe()
    total = 0.0
    has_more = True
    starting_after = None
    while has_more:
        kwargs: dict = {"status": "active", "limit": 100, "expand": ["data.items.data.price"]}
        if starting_after:
            kwargs["starting_after"] = starting_after
        result = s.Subscription.list(**kwargs)
        for sub in result.data:
            for item in sub.items.data:
                price = item.price
                if price.recurring and price.recurring.interval == "month":
                    total += (price.unit_amount or 0) / 100
        has_more = result.has_more
        if result.data:
            starting_after = result.data[-1].id
    return total
