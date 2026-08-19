"""Konphlux backend API tests — JWT auth, per-user data, Chatmonger AI."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Shared fixtures ----------
@pytest.fixture(scope="module")
def new_user():
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    return {"email": email, "password": "brass-gauge-42", "display_name": "TEST_Wilhelmina"}


@pytest.fixture(scope="module")
def auth(new_user):
    """Register a user and return {token, user, session_with_auth_headers}."""
    r = requests.post(f"{API}/auth/register", json=new_user, timeout=20)
    assert r.status_code == 201, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    token = body["access_token"]
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return {"token": token, "user": body["user"], "s": s}


@pytest.fixture(scope="module")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Auth ----------
class TestAuth:
    def test_register_returns_token_and_user(self, new_user, auth):
        u = auth["user"]
        assert u["email"] == new_user["email"]
        assert u["display_name"] == new_user["display_name"]
        assert u["handle"].startswith("@")
        assert u["id"] and "_id" not in u
        assert auth["token"] and len(auth["token"]) > 20

    def test_register_duplicate_409(self, new_user):
        r = requests.post(f"{API}/auth/register", json=new_user, timeout=20)
        assert r.status_code == 409, r.text

    def test_login_wrong_password_401(self, new_user):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": new_user["email"], "password": "wrong-password"},
            timeout=20,
        )
        assert r.status_code == 401

    def test_login_success(self, new_user):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": new_user["email"], "password": new_user["password"]},
            timeout=20,
        )
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d and d["user"]["email"] == new_user["email"]

    def test_me_requires_token(self, anon):
        r = anon.get(f"{API}/auth/me", timeout=20)
        assert r.status_code in (401, 403)

    def test_me_with_token(self, auth, new_user):
        r = auth["s"].get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == new_user["email"]


# ---------- Districts ----------
class TestDistricts:
    def test_list_public(self, anon):
        r = anon.get(f"{API}/districts", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 22
        names = [d["name"] for d in data]
        assert names == sorted(names)
        slugs = [d["slug"] for d in data]
        assert "roundtable" in slugs
        for d in data:
            assert "_id" not in d

    def test_roundtable_detail(self, auth):
        r = auth["s"].get(f"{API}/districts/roundtable", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["slug"] == "roundtable" and d["name"] == "Roundtable"
        assert isinstance(d["nearby"], list) and len(d["nearby"]) == 6
        near = [n["slug"] for n in d["nearby"]]
        assert "roundtable" not in near and "home" not in near
        assert d["chatmonger"]["name"] == "Odyn"
        assert isinstance(d["saved"], bool)

    def test_detail_requires_auth(self, anon):
        r = anon.get(f"{API}/districts/roundtable", timeout=20)
        assert r.status_code in (401, 403)

    def test_unknown_slug_404(self, auth):
        r = auth["s"].get(f"{API}/districts/does-not-exist", timeout=20)
        assert r.status_code == 404


# ---------- Feed ----------
class TestFeed:
    def test_feed_requires_auth(self, anon):
        r = anon.get(f"{API}/feed", timeout=20)
        assert r.status_code in (401, 403)

    def test_feed_shape(self, auth):
        r = auth["s"].get(f"{API}/feed", timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("stories", "trending", "suggestions", "posts"):
            assert k in d
        assert len(d["posts"]) >= 6
        for p in d["posts"]:
            assert "_id" not in p
            for k in ("id", "author", "body", "likes", "comments", "liked", "saved"):
                assert k in p

    def test_create_post_authored_by_user(self, auth):
        payload = {"body": "TEST_ dispatch — brass gauges and aether coils"}
        r = auth["s"].post(f"{API}/feed", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["author"] == auth["user"]["display_name"]
        assert p["kind"] == "You"
        assert p["likes"] == 0 and p["liked"] is False
        assert "_id" not in p
        pytest.konphlux_post_id = p["id"]

        # GET verifies persistence
        r2 = auth["s"].get(f"{API}/feed", timeout=20)
        assert p["id"] in [x["id"] for x in r2.json()["posts"]]

    def test_like_toggle_per_user(self, auth):
        r = auth["s"].post(f"{API}/feed/1/like", timeout=20)
        assert r.status_code == 200
        d1 = r.json()
        r = auth["s"].post(f"{API}/feed/1/like", timeout=20)
        d2 = r.json()
        assert d2["liked"] != d1["liked"]

    def test_like_unknown_404(self, auth):
        r = auth["s"].post(f"{API}/feed/nonexistent/like", timeout=20)
        assert r.status_code == 404


# ---------- Bazaar ----------
class TestBazaar:
    def test_bazaar_list(self, auth):
        r = auth["s"].get(f"{API}/bazaar", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert len(d["listings"]) == 8
        for item in d["listings"]:
            assert "_id" not in item
            assert "saved" in item

    def test_bazaar_item(self, auth):
        r = auth["s"].get(f"{API}/bazaar/b1", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "b1" and d["title"] == "Brass Marine Chronometer"
        assert isinstance(d["saved"], bool)

    def test_bazaar_requires_auth(self, anon):
        r = anon.get(f"{API}/bazaar", timeout=20)
        assert r.status_code in (401, 403)


# ---------- Saves ----------
class TestSaves:
    def test_toggle_listing_and_verify(self, auth):
        # save
        r = auth["s"].post(f"{API}/saves", json={"kind": "listing", "item_id": "b1"}, timeout=20)
        assert r.status_code == 200 and r.json()["saved"] is True
        # list contains it
        r = auth["s"].get(f"{API}/saves", timeout=20)
        assert r.status_code == 200
        listing_ids = [x["id"] for x in r.json()["listings"]]
        assert "b1" in listing_ids
        # toggle off
        r = auth["s"].post(f"{API}/saves", json={"kind": "listing", "item_id": "b1"}, timeout=20)
        assert r.json()["saved"] is False
        r = auth["s"].get(f"{API}/saves", timeout=20)
        assert "b1" not in [x["id"] for x in r.json()["listings"]]

    def test_toggle_district(self, auth):
        r = auth["s"].post(f"{API}/saves", json={"kind": "district", "item_id": "roundtable"}, timeout=20)
        assert r.json()["saved"] is True
        r = auth["s"].get(f"{API}/saves", timeout=20)
        assert "roundtable" in [d["slug"] for d in r.json()["districts"]]
        # district detail should reflect saved
        r = auth["s"].get(f"{API}/districts/roundtable", timeout=20)
        assert r.json()["saved"] is True

    def test_toggle_post(self, auth):
        pid = getattr(pytest, "konphlux_post_id", "1")
        r = auth["s"].post(f"{API}/saves", json={"kind": "post", "item_id": pid}, timeout=20)
        assert r.json()["saved"] is True
        r = auth["s"].get(f"{API}/saves", timeout=20)
        assert pid in [p["id"] for p in r.json()["posts"]]

    def test_unknown_kind_400(self, auth):
        r = auth["s"].post(f"{API}/saves", json={"kind": "bogus", "item_id": "x"}, timeout=20)
        assert r.status_code == 400

    def test_saves_require_auth(self, anon):
        r = anon.get(f"{API}/saves", timeout=20)
        assert r.status_code in (401, 403)


# ---------- Chatmonger (real LLM) ----------
class TestChatmonger:
    def test_history_shape(self, auth):
        r = auth["s"].get(f"{API}/chatmonger/roundtable", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["district"] == "Roundtable"
        assert d["chatmonger"]["name"] == "Odyn"
        assert isinstance(d["messages"], list)

    def test_send_message_ai_reply(self, auth):
        payload = {"message": "In one short sentence, what is Roundtable for?"}
        r = auth["s"].post(f"{API}/chatmonger/roundtable", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "assistant"
        assert isinstance(d["text"], str) and len(d["text"]) > 0
        # history now contains at least user + assistant messages
        r2 = auth["s"].get(f"{API}/chatmonger/roundtable", timeout=20)
        msgs = r2.json()["messages"]
        assert any(m["role"] == "user" and m["text"] == payload["message"] for m in msgs)
        assert any(m["role"] == "assistant" for m in msgs)

    def test_unknown_district_404(self, auth):
        r = auth["s"].post(f"{API}/chatmonger/nope", json={"message": "hi"}, timeout=20)
        assert r.status_code == 404


# ---------- Profile ----------
class TestProfile:
    def test_profile_uses_authed_user(self, auth):
        r = auth["s"].get(f"{API}/profile", timeout=20)
        assert r.status_code == 200
        p = r.json()
        assert p["display_name"] == auth["user"]["display_name"]
        assert p["handle"] == auth["user"]["handle"]
        assert isinstance(p["stats"]["posts"], int)

    def test_profile_requires_auth(self, anon):
        r = anon.get(f"{API}/profile", timeout=20)
        assert r.status_code in (401, 403)
