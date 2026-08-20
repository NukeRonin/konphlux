"""Author Anvil (Konphlux) — backend API tests.

Covers writing/publishing routes at /api/anvil*: works CRUD, applause toggle,
co-writing contributions, prompt list, and AI GenoScribe/AIventure endpoints.
"""

import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"


# ---------- helpers / fixtures ----------
def _register(name_prefix: str) -> dict:
    email = f"anvil_{name_prefix}_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "steam123", "display_name": name_prefix.title()}
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"register failed {r.status_code}: {r.text}"
    data = r.json()
    assert "access_token" in data
    return {"token": data["access_token"], "email": email, "user": data.get("user", {})}


@pytest.fixture(scope="module")
def author():
    return _register("author")


@pytest.fixture(scope="module")
def cowriter():
    return _register("cowriter")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- GET /api/anvil ----------
class TestAnvilList:
    def test_list_default(self, author):
        r = requests.get(f"{BASE_URL}/api/anvil", headers=_auth(author["token"]), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "works" in data and "categories" in data
        assert isinstance(data["works"], list)
        ids = {w["id"] for w in data["works"]}
        # seed works w1..w3 must be present
        for wid in ("w1", "w2", "w3"):
            assert wid in ids, f"seed work {wid} missing"

    def test_list_kind_story(self, author):
        r = requests.get(f"{BASE_URL}/api/anvil?kind=story", headers=_auth(author["token"]), timeout=20)
        assert r.status_code == 200
        for w in r.json()["works"]:
            assert w["kind"] == "story"

    def test_list_kind_script(self, author):
        r = requests.get(f"{BASE_URL}/api/anvil?kind=script", headers=_auth(author["token"]), timeout=20)
        assert r.status_code == 200
        for w in r.json()["works"]:
            assert w["kind"] == "script"

    def test_list_category_filter(self, author):
        # first find a category from unfiltered list
        r = requests.get(f"{BASE_URL}/api/anvil", headers=_auth(author["token"]), timeout=20)
        cats = r.json()["categories"]
        assert cats, "expected some categories from seed"
        cat = cats[0]
        r2 = requests.get(f"{BASE_URL}/api/anvil?category={cat}", headers=_auth(author["token"]), timeout=20)
        assert r2.status_code == 200
        for w in r2.json()["works"]:
            assert w["category"] == cat


# ---------- POST /api/anvil (create) ----------
class TestAnvilCreate:
    def test_create_story_success(self, author):
        payload = {
            "title": "TEST_The Aether Compass",
            "kind": "story",
            "category": "Sci-Fi",
            "body": "The compass hummed, its needle spinning against invisible currents of aether.",
            "open_cowriting": False,
        }
        r = requests.post(f"{BASE_URL}/api/anvil", headers=_auth(author["token"]), json=payload, timeout=20)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["title"] == payload["title"]
        assert d["kind"] == "story"
        assert d["is_author"] is True
        assert d["applause"] == 0
        assert d["excerpt"]
        assert "id" in d
        # verify persistence via GET detail
        rid = requests.get(f"{BASE_URL}/api/anvil/{d['id']}", headers=_auth(author["token"]), timeout=20)
        assert rid.status_code == 200
        assert rid.json()["title"] == payload["title"]

    def test_create_invalid_kind_400(self, author):
        payload = {"title": "TEST_bad kind", "kind": "poem", "body": "..."}
        r = requests.post(f"{BASE_URL}/api/anvil", headers=_auth(author["token"]), json=payload, timeout=20)
        assert r.status_code == 400

    def test_create_short_title_422(self, author):
        payload = {"title": "x", "kind": "story", "body": "abc"}
        r = requests.post(f"{BASE_URL}/api/anvil", headers=_auth(author["token"]), json=payload, timeout=20)
        # Pydantic validation → 422
        assert r.status_code == 422

    def test_create_missing_body(self, author):
        payload = {"title": "TEST_no body", "kind": "story"}
        r = requests.post(f"{BASE_URL}/api/anvil", headers=_auth(author["token"]), json=payload, timeout=20)
        assert r.status_code == 422


# ---------- GET /api/anvil/{id} ----------
class TestAnvilDetail:
    def test_detail_seed(self, author):
        r = requests.get(f"{BASE_URL}/api/anvil/w1", headers=_auth(author["token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == "w1"
        assert d["body"]
        assert "contributions" in d and isinstance(d["contributions"], list)
        assert "is_author" in d
        assert "applauded" in d

    def test_detail_404(self, author):
        r = requests.get(f"{BASE_URL}/api/anvil/nonexistent_id", headers=_auth(author["token"]), timeout=20)
        assert r.status_code == 404


# ---------- POST /api/anvil/{id}/applause ----------
class TestAnvilApplause:
    def test_applause_toggle(self, author):
        r0 = requests.get(f"{BASE_URL}/api/anvil/w1", headers=_auth(author["token"]), timeout=20)
        start = r0.json()["applause"]
        r1 = requests.post(f"{BASE_URL}/api/anvil/w1/applause", headers=_auth(author["token"]), timeout=20)
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["applauded"] is True
        assert d1["applause"] == start + 1
        # toggle off
        r2 = requests.post(f"{BASE_URL}/api/anvil/w1/applause", headers=_auth(author["token"]), timeout=20)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["applauded"] is False
        assert d2["applause"] == start


# ---------- Co-writing ----------
class TestAnvilCowriting:
    def test_cowriting_list_only_open(self, author):
        r = requests.get(f"{BASE_URL}/api/anvil/cowriting", headers=_auth(author["token"]), timeout=20)
        assert r.status_code == 200
        works = r.json()
        assert isinstance(works, list)
        for w in works:
            assert w.get("open_cowriting") is True
        ids = {w["id"] for w in works}
        # w2 and w3 are seeded as open_cowriting=True per test_credentials.md
        assert "w2" in ids
        assert "w3" in ids

    def test_contribute_to_open_work(self, author, cowriter):
        # create a fresh open work as author, then cowriter contributes
        create = requests.post(
            f"{BASE_URL}/api/anvil",
            headers=_auth(author["token"]),
            json={
                "title": "TEST_Open Collab",
                "kind": "story",
                "category": "Adventure",
                "body": "It began in a copper foundry, sparks flying like fireflies.",
                "open_cowriting": True,
            },
            timeout=20,
        )
        assert create.status_code == 201
        wid = create.json()["id"]
        contrib = requests.post(
            f"{BASE_URL}/api/anvil/{wid}/contribute",
            headers=_auth(cowriter["token"]),
            json={"body": "TEST_A stranger appeared through the steam curtain."},
            timeout=20,
        )
        assert contrib.status_code == 201, contrib.text
        c = contrib.json()
        assert c["work_id"] == wid
        assert "id" in c
        # detail should now contain the contribution
        det = requests.get(f"{BASE_URL}/api/anvil/{wid}", headers=_auth(author["token"]), timeout=20)
        assert det.status_code == 200
        bodies = [x["body"] for x in det.json()["contributions"]]
        assert any("TEST_A stranger" in b for b in bodies)

    def test_contribute_to_closed_work_403(self, author, cowriter):
        # create a closed work; contributing should 403
        create = requests.post(
            f"{BASE_URL}/api/anvil",
            headers=_auth(author["token"]),
            json={
                "title": "TEST_Closed Vault",
                "kind": "story",
                "category": "Mystery",
                "body": "A locked ledger, a sealed lift, a whisper in brass.",
                "open_cowriting": False,
            },
            timeout=20,
        )
        assert create.status_code == 201
        wid = create.json()["id"]
        r = requests.post(
            f"{BASE_URL}/api/anvil/{wid}/contribute",
            headers=_auth(cowriter["token"]),
            json={"body": "TEST_should be forbidden"},
            timeout=20,
        )
        assert r.status_code == 403


# ---------- Prompts ----------
class TestAnvilPrompts:
    def test_prompts(self, author):
        r = requests.get(f"{BASE_URL}/api/anvil/prompts", headers=_auth(author["token"]), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("prompts"), list)
        assert len(d["prompts"]) == 12, f"expected 12 prompts, got {len(d['prompts'])}"
        assert isinstance(d.get("categories"), list)
        assert len(d["categories"]) == 10, f"expected 10 categories, got {len(d['categories'])}"


# ---------- AI GenoScribe (may take several seconds) ----------
class TestAnvilAssist:
    def test_assist_idea(self, author):
        r = requests.post(
            f"{BASE_URL}/api/anvil/assist",
            headers=_auth(author["token"]),
            json={"mode": "idea", "kind": "story", "title": "Brass Skies"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        assert (r.json().get("text") or "").strip(), "empty idea text"

    def test_assist_continue(self, author):
        r = requests.post(
            f"{BASE_URL}/api/anvil/assist",
            headers=_auth(author["token"]),
            json={
                "mode": "continue",
                "kind": "story",
                "title": "The Gearwright",
                "text": "Ada wound the mainspring and the workshop shuddered awake.",
            },
            timeout=60,
        )
        assert r.status_code == 200, r.text
        assert (r.json().get("text") or "").strip()

    def test_assist_improve(self, author):
        r = requests.post(
            f"{BASE_URL}/api/anvil/assist",
            headers=_auth(author["token"]),
            json={
                "mode": "improve",
                "kind": "story",
                "text": "The room was cold. The man walked in. He was tired.",
            },
            timeout=60,
        )
        assert r.status_code == 200, r.text
        assert (r.json().get("text") or "").strip()


# ---------- AIventure ----------
class TestAnvilAdventure:
    def test_adventure_opener(self, author):
        r = requests.post(
            f"{BASE_URL}/api/anvil/adventure",
            headers=_auth(author["token"]),
            json={"history": [], "action": "I step onto the pier"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        text = (r.json().get("text") or "").strip()
        assert text, "empty adventure text"
        # keep for continuation
        pytest.first_adventure_text = text

    def test_adventure_continuation(self, author):
        prior = getattr(pytest, "first_adventure_text", "The pier creaks. Steam rises. What do you do?")
        history = [
            {"role": "user", "content": "I step onto the pier"},
            {"role": "assistant", "content": prior},
        ]
        r = requests.post(
            f"{BASE_URL}/api/anvil/adventure",
            headers=_auth(author["token"]),
            json={"history": history, "action": "I hail the passing airship"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        assert (r.json().get("text") or "").strip()


# ---------- Auth guard ----------
class TestAnvilAuth:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/anvil", timeout=20)
        assert r.status_code in (401, 403)
