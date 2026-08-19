"""Order-receipt email + fulfillment idempotency tests for Konphlux.

Covers:
- email_service.send_order_receipt returns a non-null id from the Emergent
  managed email proxy (using delivered@resend.dev as the recipient).
- Guardrail _assert_safe_email is enforced (fixed server-side template only).
- server._fulfill_paid_order marks the order paid, clears the buyer cart,
  sets email_sent=True, and does NOT resend on a second call.
- GET /api/orders returns the order as paid after fulfillment.
- Regression on POST /api/checkout (cs_test_) and POST /api/stripe/webhook.
"""
import os
import sys
import uuid
from pathlib import Path

import pytest
import requests

# Make backend/ importable for direct access to server + email_service
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
RETURN_BASE = BASE_URL


# ---------------------------- helpers ----------------------------
def _register():
    email = f"test_receipt_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "brass-gauge-42", "display_name": "TEST_Buyer"},
        timeout=20,
    )
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s, r.json()["user"], email


# ============================================================
# 1) email_service module + direct send
# ============================================================
class TestEmailService:
    def test_module_imports_and_env(self):
        import email_service as es
        assert es.EMAIL_FROM_NAME == "Konphlux", es.EMAIL_FROM_NAME
        assert es.EMAIL_KEY and es.EMAIL_KEY.startswith("ek_"), "EMERGENT_EMAIL_KEY must be loaded"
        # Emergent proxy is a CONSTANT, never env-read
        assert es.EMAIL_BASE_URL == "https://integrations.emergentagent.com"
        assert callable(es.send_order_receipt)
        assert callable(es._assert_safe_email)

    @pytest.mark.asyncio
    async def test_send_order_receipt_returns_id(self):
        import email_service as es
        order = {
            "id": "abc12345deadbeef",
            "amount_cents": 51900,
            "lines": [
                {"title": "Brass Marine Chronometer", "qty": 1, "unit_amount": 42000},
                {"title": "Hand-Bound Parchment Journal", "qty": 1, "unit_amount": 3400},
                {"title": "Copperline Calipers", "qty": 1, "unit_amount": 6500},
            ],
        }
        result = await es.send_order_receipt(
            to="delivered@resend.dev", name="Ada Lovelace", order=order
        )
        # Emergent proxy returns an id on 200/202. None => proxy 4xx/5xx.
        assert result, f"Expected non-null email id, got {result!r}"

    def test_guardrail_rejects_forms(self):
        import email_service as es
        with pytest.raises(ValueError):
            es._assert_safe_email("Sub", "<form><input name='pw'/></form>")

    def test_guardrail_rejects_credential_ask(self):
        import email_service as es
        with pytest.raises(ValueError):
            es._assert_safe_email("Sub", "<p>please reply with your password</p>")

    def test_guardrail_rejects_non_https(self):
        import email_service as es
        with pytest.raises(ValueError):
            es._assert_safe_email("Sub", '<a href="http://example.com">click</a>')

    def test_guardrail_accepts_fixed_template(self):
        import email_service as es
        # Same fixed template shape used by send_order_receipt: no forms, https-only, no cred ask.
        es._assert_safe_email(
            "Your Konphlux order ABCD is confirmed",
            '<table><tr><td>Thank you, Ada — your order is confirmed.</td></tr></table>',
        )


# ============================================================
# 2) Fulfillment idempotency + /orders integration
# ============================================================
class TestFulfillmentIdempotency:
    @pytest.mark.asyncio
    async def test_fulfill_marks_paid_clears_cart_and_is_idempotent(self):
        # a) Register, add to cart, checkout to create a pending order + Stripe session
        s, user, email = _register()

        r = s.post(f"{API}/cart", json={"item_id": "b2", "qty": 1}, timeout=20)
        assert r.status_code == 200 and r.json()["count"] == 1

        r = s.post(f"{API}/checkout", json={"return_base": RETURN_BASE}, timeout=30)
        assert r.status_code == 200, r.text
        checkout = r.json()
        session_id = checkout["session_id"]
        assert session_id.startswith("cs_test_"), checkout
        assert checkout["checkout_url"].startswith("https://checkout.stripe.com")

        # Before fulfillment: /orders empty
        r = s.get(f"{API}/orders", timeout=20)
        assert r.status_code == 200 and r.json() == []

        # b) Call server._fulfill_paid_order(session_id) directly
        import server
        await server._fulfill_paid_order(session_id)

        # c) Verify order + cart + email_sent
        r = s.get(f"{API}/orders", timeout=20)
        assert r.status_code == 200
        orders = r.json()
        assert len(orders) == 1, orders
        o = orders[0]
        assert o["session_id"] == session_id
        assert o["payment_status"] == "paid"
        assert o["status"] == "paid"
        assert "_id" not in o
        assert isinstance(o["lines"], list) and len(o["lines"]) == 1

        r = s.get(f"{API}/cart", timeout=20)
        assert r.status_code == 200 and r.json()["items"] == []

        raw = await server.db.orders.find_one({"session_id": session_id})
        assert raw is not None
        assert raw.get("email_sent") is True, raw

        # d) Second call must NOT resend. Patch send_order_receipt to detect resend.
        import email_service
        calls = {"n": 0}
        original = email_service.send_order_receipt

        async def _spy(**kwargs):
            calls["n"] += 1
            return "resent-id"

        email_service.send_order_receipt = _spy
        # server imports the symbol at module load — patch there too
        server.send_order_receipt = _spy
        try:
            await server._fulfill_paid_order(session_id)
        finally:
            email_service.send_order_receipt = original
            server.send_order_receipt = original

        assert calls["n"] == 0, "Second _fulfill_paid_order must not resend the receipt"

        raw2 = await server.db.orders.find_one({"session_id": session_id})
        assert raw2.get("email_sent") is True


# ============================================================
# 3) Regression on checkout + stripe webhook
# ============================================================
class TestRegression:
    def test_checkout_creates_cs_test_session(self):
        s, _, _ = _register()
        r = s.post(f"{API}/cart", json={"item_id": "b1", "qty": 1}, timeout=20)
        assert r.status_code == 200
        r = s.post(f"{API}/checkout", json={"return_base": RETURN_BASE}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_id"].startswith("cs_test_")
        assert d["checkout_url"].startswith("https://checkout.stripe.com")

    def test_stripe_webhook_without_secret_returns_200(self):
        # STRIPE_WEBHOOK_SECRET is blank in .env -> endpoint short-circuits to {received: true}
        r = requests.post(
            f"{API}/stripe/webhook",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("received") is True

    def test_orders_requires_auth(self):
        r = requests.get(f"{API}/orders", timeout=20)
        assert r.status_code in (401, 403)

    def test_cart_requires_auth(self):
        r = requests.get(f"{API}/cart", timeout=20)
        assert r.status_code in (401, 403)

    def test_checkout_requires_auth(self):
        r = requests.post(f"{API}/checkout", json={"return_base": RETURN_BASE}, timeout=20)
        assert r.status_code in (401, 403)
