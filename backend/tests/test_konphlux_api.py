"""Konphlux backend API tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://web-to-mobile-252.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ------------ Districts ------------
class TestDistricts:
    def test_list_returns_22_sorted(self, s):
        r = s.get(f"{API}/districts", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 22, f"expected 22 districts, got {len(data)}"
        names = [d["name"] for d in data]
        assert names == sorted(names), "districts should be sorted by name"
        # No mongo _id
        for d in data:
            assert "_id" not in d
            assert set(["slug", "name", "icon", "tagline", "description", "chatmonger", "features"]).issubset(d.keys())

    def test_get_by_slug_and_nearby(self, s):
        r = s.get(f"{API}/districts/bazaar", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["slug"] == "bazaar"
        assert d["name"] == "Bazaar"
        assert "nearby" in d and isinstance(d["nearby"], list)
        assert len(d["nearby"]) == 6, f"expected 6 nearby, got {len(d['nearby'])}"
        # nearby should exclude the current one and 'home'
        slugs = [n["slug"] for n in d["nearby"]]
        assert "bazaar" not in slugs
        assert "home" not in slugs

    def test_get_home_slug(self, s):
        r = s.get(f"{API}/districts/home", timeout=20)
        assert r.status_code == 200
        assert r.json()["slug"] == "home"

    def test_get_unknown_slug_404(self, s):
        r = s.get(f"{API}/districts/does-not-exist", timeout=20)
        assert r.status_code == 404


# ------------ Feed ------------
class TestFeed:
    def test_get_feed_shape(self, s):
        r = s.get(f"{API}/feed", timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("stories", "trending", "suggestions", "posts"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["posts"], list) and len(d["posts"]) >= 6
        for p in d["posts"]:
            assert "_id" not in p
            for k in ("id", "author", "kind", "time", "body", "likes", "comments", "liked"):
                assert k in p

    def test_create_post_and_verify(self, s):
        payload = {"body": "TEST_ post — brass gauges and aether coils"}
        r = s.post(f"{API}/feed", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["body"] == payload["body"]
        assert p["time"] == "just now"
        assert p["likes"] == 0 and p["liked"] is False
        assert "id" in p and len(p["id"]) > 0
        assert "_id" not in p
        # Verify persistence via GET /feed
        r2 = s.get(f"{API}/feed", timeout=20)
        ids = [x["id"] for x in r2.json()["posts"]]
        assert p["id"] in ids
        # store for like test
        pytest.created_post_id = p["id"]

    def test_toggle_like(self, s):
        # Use a seeded id "1"
        r = s.post(f"{API}/feed/1/like", timeout=20)
        assert r.status_code == 200, r.text
        d1 = r.json()
        assert d1["id"] == "1"
        assert isinstance(d1["liked"], bool)
        assert isinstance(d1["likes"], int)
        # toggle again -> flips
        r = s.post(f"{API}/feed/1/like", timeout=20)
        d2 = r.json()
        assert d2["liked"] != d1["liked"]
        assert d2["likes"] == d1["likes"] + (1 if d2["liked"] else -1)

    def test_like_unknown_post_404(self, s):
        r = s.post(f"{API}/feed/nonexistent/like", timeout=20)
        assert r.status_code == 404


# ------------ Bazaar ------------
class TestBazaar:
    def test_list(self, s):
        r = s.get(f"{API}/bazaar", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "categories" in d and "listings" in d
        assert len(d["listings"]) == 8
        for item in d["listings"]:
            assert "_id" not in item
            for k in ("id", "title", "price_cents", "seller", "rating", "reviews", "category", "image", "description"):
                assert k in item
        # categories should be unique + sorted
        assert d["categories"] == sorted(set(d["categories"]))

    def test_get_by_id(self, s):
        r = s.get(f"{API}/bazaar/b1", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "b1"
        assert d["title"] == "Brass Marine Chronometer"

    def test_get_unknown_id_404(self, s):
        r = s.get(f"{API}/bazaar/does-not-exist", timeout=20)
        assert r.status_code == 404


# ------------ Profile ------------
class TestProfile:
    def test_get_profile(self, s):
        r = s.get(f"{API}/profile", timeout=20)
        assert r.status_code == 200
        p = r.json()
        assert p["display_name"] == "Wilhelmina Grast"
        assert "stats" in p and set(["posts", "followers", "following"]).issubset(p["stats"].keys())
        assert isinstance(p["balance_cents"], int)
        assert isinstance(p["menu"], list) and len(p["menu"]) == 4
        for group in p["menu"]:
            assert "group" in group and "items" in group
