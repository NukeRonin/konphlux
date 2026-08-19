"""Stripe webhook endpoint smoke test."""
import os
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def test_webhook_no_secret_returns_200():
    """When STRIPE_WEBHOOK_SECRET is not configured, endpoint should not 500."""
    r = requests.post(f"{API}/stripe/webhook", data=b"{}", timeout=20,
                      headers={"stripe-signature": "test"})
    # Either 200 (no secret configured) OR 400 (invalid sig when secret set) - never 500
    assert r.status_code in (200, 400), r.text
    if r.status_code == 200:
        assert r.json().get("received") is True
