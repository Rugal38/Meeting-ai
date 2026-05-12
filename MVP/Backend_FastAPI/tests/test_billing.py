"""Tests for Stripe webhook signature verification."""
import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient

# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_stripe_signature(payload: bytes, secret: str, timestamp: int | None = None) -> str:
    """Build a valid stripe-signature header value."""
    ts = timestamp or int(time.time())
    signed = f"{ts}.{payload.decode()}"
    mac = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
    return f"t={ts},v1={mac}"


def _make_event(event_type: str, data: dict) -> dict:
    return {"type": event_type, "data": {"object": data}}


# ── Fixtures ──────────────────────────────────────────────────────────────────

WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests"


@pytest.fixture(scope="module")
def client():
    """TestClient with Stripe webhook secret configured."""
    import os
    os.environ.update({
        "STRIPE_WEBHOOK_SECRET": WEBHOOK_SECRET,
        "STRIPE_SECRET_KEY": "sk_test_dummy",
        "DATABASE_URL": "sqlite:///:memory:",
        "JWT_SECRET": "test-secret",
    })
    # Import app AFTER setting env vars so settings pick them up
    from app.main import app
    return TestClient(app)


# ── Signature verification tests ─────────────────────────────────────────────

class TestWebhookSignatureVerification:

    def test_valid_signature_accepted(self, client):
        event = _make_event("checkout.session.completed", {"mode": "subscription", "customer": "cus_test", "subscription": "sub_test"})
        payload = json.dumps(event).encode()
        sig = _make_stripe_signature(payload, WEBHOOK_SECRET)
        response = client.post(
            "/api/billing/webhook",
            content=payload,
            headers={"stripe-signature": sig, "content-type": "application/json"},
        )
        # We expect 200 (even if Stripe customer lookup fails, the signature was valid)
        assert response.status_code == 200

    def test_missing_signature_rejected(self, client):
        payload = json.dumps(_make_event("checkout.session.completed", {})).encode()
        response = client.post(
            "/api/billing/webhook",
            content=payload,
            headers={"content-type": "application/json"},
        )
        assert response.status_code == 400

    def test_tampered_payload_rejected(self, client):
        event = _make_event("checkout.session.completed", {"customer": "cus_original"})
        payload = json.dumps(event).encode()
        sig = _make_stripe_signature(payload, WEBHOOK_SECRET)

        # Tamper with the payload after signing
        tampered = json.dumps(_make_event("checkout.session.completed", {"customer": "cus_attacker"})).encode()
        response = client.post(
            "/api/billing/webhook",
            content=tampered,
            headers={"stripe-signature": sig, "content-type": "application/json"},
        )
        assert response.status_code == 400

    def test_wrong_secret_rejected(self, client):
        event = _make_event("customer.subscription.deleted", {"id": "sub_123"})
        payload = json.dumps(event).encode()
        sig = _make_stripe_signature(payload, "whsec_wrong_secret")
        response = client.post(
            "/api/billing/webhook",
            content=payload,
            headers={"stripe-signature": sig, "content-type": "application/json"},
        )
        assert response.status_code == 400

    def test_expired_timestamp_rejected(self, client):
        """Stripe rejects signatures older than 5 minutes by default."""
        event = _make_event("invoice.payment_failed", {"customer": "cus_test"})
        payload = json.dumps(event).encode()
        old_ts = int(time.time()) - 400  # 400 seconds ago (> 300s tolerance)
        sig = _make_stripe_signature(payload, WEBHOOK_SECRET, timestamp=old_ts)
        response = client.post(
            "/api/billing/webhook",
            content=payload,
            headers={"stripe-signature": sig, "content-type": "application/json"},
        )
        assert response.status_code == 400
