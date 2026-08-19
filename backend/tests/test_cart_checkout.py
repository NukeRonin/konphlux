"""Cart + Stripe Checkout backend tests (test-mode Stripe key)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
RETURN_BASE = "https://web-to-mobile-252.preview.emergentagent.com"


@pytest.fixture(scope="module")
def auth():
    email = f"test_cart_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "brass-gauge-42", "display_name": "TEST_Cartier"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return {"s": s, "user": r.json()["user"], "email": email}


@pytest.fixture(scope="module")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ----- CART -----
class TestCart:
    def test_cart_requires_auth(self, anon):
        r = anon.get(f"{API}/cart", timeout=20)
        assert r.status_code in (401, 403)

    def test_empty_cart(self, auth):
        r = auth["s"].get(f"{API}/cart", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["items"] == [] and d["subtotal_cents"] == 0 and d["count"] == 0

    def test_add_item(self, auth):
        r = auth["s"].post(f"{API}/cart", json={"item_id": "b1", "qty": 1}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["count"] == 1 and d["subtotal_cents"] == 42000
        assert d["items"][0]["item_id"] == "b1" and d["items"][0]["qty"] == 1
        assert d["items"][0]["title"] == "Brass Marine Chronometer"
        assert d["items"][0]["line_cents"] == 42000
        assert "_id" not in d["items"][0]

    def test_add_increments_qty(self, auth):
        r = auth["s"].post(f"{API}/cart", json={"item_id": "b1", "qty": 2}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["items"][0]["qty"] == 3
        assert d["count"] == 3
        assert d["subtotal_cents"] == 42000 * 3

    def test_add_second_item_via_get(self, auth):
        r = auth["s"].post(f"{API}/cart", json={"item_id": "b5", "qty": 1}, timeout=20)
        assert r.status_code == 200
        # Verify GET reflects both
        r = auth["s"].get(f"{API}/cart", timeout=20)
        d = r.json()
        ids = {i["item_id"]: i["qty"] for i in d["items"]}
        assert ids.get("b1") == 3 and ids.get("b5") == 1
        assert d["subtotal_cents"] == 42000 * 3 + 3400

    def test_patch_sets_qty(self, auth):
        r = auth["s"].patch(f"{API}/cart/b1", json={"qty": 2}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        ids = {i["item_id"]: i["qty"] for i in d["items"]}
        assert ids["b1"] == 2

    def test_patch_zero_removes(self, auth):
        r = auth["s"].patch(f"{API}/cart/b5", json={"qty": 0}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "b5" not in {i["item_id"] for i in d["items"]}

    def test_delete_removes(self, auth):
        # Add then delete
        auth["s"].post(f"{API}/cart", json={"item_id": "b7", "qty": 1}, timeout=20)
        r = auth["s"].delete(f"{API}/cart/b7", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "b7" not in {i["item_id"] for i in d["items"]}

    def test_add_unknown_item_404(self, auth):
        r = auth["s"].post(f"{API}/cart", json={"item_id": "does-not-exist", "qty": 1}, timeout=20)
        assert r.status_code == 404


# ----- CHECKOUT -----
class TestCheckout:
    def test_checkout_requires_auth(self, anon):
        r = anon.post(f"{API}/checkout", json={"return_base": RETURN_BASE}, timeout=20)
        assert r.status_code in (401, 403)

    def test_checkout_empty_cart_400(self):
        # Fresh user w/ empty cart
        email = f"test_empty_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "brass-gauge-42", "display_name": "TEST_Empty"},
                          timeout=20)
        assert r.status_code == 201
        token = r.json()["access_token"]
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
        r = s.post(f"{API}/checkout", json={"return_base": RETURN_BASE}, timeout=20)
        assert r.status_code == 400, r.text

    def test_checkout_invalid_return_400(self, auth):
        r = auth["s"].post(f"{API}/checkout", json={"return_base": "not-a-url"}, timeout=20)
        assert r.status_code == 400

    def test_checkout_creates_session_and_pending_order(self, auth):
        # Ensure cart has at least one item (parallel workers may have empty cart)
        auth["s"].post(f"{API}/cart", json={"item_id": "b2", "qty": 1}, timeout=20)
        r = auth["s"].get(f"{API}/cart", timeout=20)
        assert r.json()["count"] >= 1

        r = auth["s"].post(f"{API}/checkout", json={"return_base": RETURN_BASE}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_id"].startswith("cs_test_"), d
        assert d["checkout_url"].startswith("https://checkout.stripe.com"), d
        pytest.konphlux_session_id = d["session_id"]

        # Orders list is empty (pending orders not returned)
        r = auth["s"].get(f"{API}/orders", timeout=20)
        assert r.status_code == 200
        assert r.json() == []

    def test_status_pending_before_payment(self, auth):
        sid = pytest.konphlux_session_id
        r = auth["s"].get(f"{API}/checkout/status/{sid}", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paid"] is False
        assert d["order"]["status"] == "pending"
        assert d["order"]["session_id"] == sid
        assert d["order"]["payment_status"] == "unpaid"
        assert "_id" not in d["order"]
        assert isinstance(d["order"]["lines"], list) and len(d["order"]["lines"]) >= 1

    def test_status_unknown_session_404(self, auth):
        r = auth["s"].get(f"{API}/checkout/status/cs_test_notreal", timeout=20)
        assert r.status_code == 404

    def test_status_other_user_cannot_read(self, auth):
        sid = pytest.konphlux_session_id
        email = f"test_other_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "brass-gauge-42", "display_name": "TEST_Other"},
                          timeout=20)
        token = r.json()["access_token"]
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
        r = s.get(f"{API}/checkout/status/{sid}", timeout=20)
        assert r.status_code == 404

    def test_checkout_return_html(self):
        r = requests.get(f"{API}/checkout/return?result=success&session_id=cs_test_x", timeout=20)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert "Payment complete" in r.text

        r = requests.get(f"{API}/checkout/return?result=cancel", timeout=20)
        assert r.status_code == 200
        assert "Checkout cancelled" in r.text

    def test_orders_requires_auth(self, anon):
        r = anon.get(f"{API}/orders", timeout=20)
        assert r.status_code in (401, 403)
