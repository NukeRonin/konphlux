"""GenoScribe backend API tests.

Covers:
  - POST /api/anvil/genoscribe for tool = story | script | prompt (real Emergent LLM)
  - Invalid tool → 400
  - POST /api/anvil/prompts (add user prompt), GET /api/anvil/prompts (user prompt first)
  - Posting AI story/script via POST /api/anvil and verifying via GET /api/anvil?kind=
  - Regression: applause toggle, contribute (co-writing)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"

LLM_TIMEOUT = 45  # allow real LLM latency (up to ~20s per call)


# ---------- helpers ----------
def _register(prefix: str) -> dict:
    email = f"geno_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "steam123", "display_name": prefix.title()}
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    return {"token": r.json()["access_token"], "email": email}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def user():
    return _register("user")


@pytest.fixture(scope="module")
def cowriter():
    return _register("cowriter")


# ---------- GenoScribe generation ----------
class TestGenoScribeGenerate:
    def test_story_generation_returns_title_and_text(self, user):
        r = requests.post(
            f"{BASE_URL}/api/anvil/genoscribe",
            json={"tool": "story", "topic": "a clockwork owl that reads letters", "tone": "Whimsical", "genre": "Fantasy", "length": "short"},
            headers=_auth(user["token"]),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        assert data["tool"] == "story"
        assert isinstance(data.get("title"), str) and data["title"].strip(), f"empty title: {data}"
        assert isinstance(data.get("text"), str) and len(data["text"].strip()) > 40, f"empty/short text: {data}"

    def test_script_generation_returns_title_and_text(self, user):
        r = requests.post(
            f"{BASE_URL}/api/anvil/genoscribe",
            json={"tool": "script", "topic": "two mechanics arguing over a broken pressure gauge", "tone": "Dark", "length": "short"},
            headers=_auth(user["token"]),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        assert data["tool"] == "script"
        assert data.get("title", "").strip(), f"empty title: {data}"
        assert len(data.get("text", "").strip()) > 40

    def test_prompt_generation_returns_text_no_title(self, user):
        r = requests.post(
            f"{BASE_URL}/api/anvil/genoscribe",
            json={"tool": "prompt", "topic": "forgotten automatons in the boiler room"},
            headers=_auth(user["token"]),
            timeout=LLM_TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        assert data["tool"] == "prompt"
        assert data.get("title", "") == ""
        assert isinstance(data.get("text"), str) and len(data["text"].strip()) > 8

    def test_invalid_tool_returns_400(self, user):
        r = requests.post(
            f"{BASE_URL}/api/anvil/genoscribe",
            json={"tool": "essay", "topic": "anything"},
            headers=_auth(user["token"]),
            timeout=20,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


# ---------- Prompt posting ----------
class TestPromptPost:
    def test_add_prompt_and_appears_first(self, user):
        text = f"TEST prompt about clockwork {uuid.uuid4().hex[:6]}: a lamp that dims when lied to."
        r = requests.post(
            f"{BASE_URL}/api/anvil/prompts",
            json={"text": text},
            headers=_auth(user["token"]),
            timeout=20,
        )
        assert r.status_code == 201, f"{r.status_code}: {r.text}"
        created = r.json()
        assert created["text"] == text

        # GET verifies user prompts come before seeded ones (12 seeded)
        g = requests.get(f"{BASE_URL}/api/anvil/prompts", headers=_auth(user["token"]), timeout=20)
        assert g.status_code == 200
        body = g.json()
        prompts = body["prompts"]
        assert text in prompts, "created prompt should appear in list"
        # Position: the freshly-created prompt should be near the top (before the 12 seeded ones)
        idx = prompts.index(text)
        assert idx < len(prompts) - 12, f"user prompt not before seeded ones: idx={idx}, total={len(prompts)}"

    def test_prompt_too_short_422(self, user):
        r = requests.post(
            f"{BASE_URL}/api/anvil/prompts",
            json={"text": "short"},
            headers=_auth(user["token"]),
            timeout=15,
        )
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"


# ---------- Posting AI story / script through POST /api/anvil ----------
class TestPostAIWorks:
    def test_post_ai_story_appears_in_stories(self, user):
        title = f"TEST AI Story {uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/anvil",
            json={"title": title, "kind": "story", "category": "Fantasy", "body": "A short AI-generated tale about a brass owl and a lit lamp.", "open_cowriting": False},
            headers=_auth(user["token"]),
            timeout=20,
        )
        assert r.status_code == 201, f"{r.status_code}: {r.text}"
        work = r.json()
        assert work["kind"] == "story"
        assert work["title"] == title

        # Verify GET /api/anvil?kind=story includes it
        g = requests.get(f"{BASE_URL}/api/anvil?kind=story", headers=_auth(user["token"]), timeout=15)
        assert g.status_code == 200
        works = g.json()["works"]
        ids = {w["id"] for w in works}
        assert work["id"] in ids

    def test_post_ai_script_appears_in_scripts(self, user):
        title = f"TEST AI Script {uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/anvil",
            json={"title": title, "kind": "script", "category": "Drama", "body": "INT. WORKSHOP - NIGHT\n\nA clockmaker inspects a silent gear.", "open_cowriting": False},
            headers=_auth(user["token"]),
            timeout=20,
        )
        assert r.status_code == 201, f"{r.status_code}: {r.text}"
        work = r.json()
        assert work["kind"] == "script"

        g = requests.get(f"{BASE_URL}/api/anvil?kind=script", headers=_auth(user["token"]), timeout=15)
        assert g.status_code == 200
        ids = {w["id"] for w in g.json()["works"]}
        assert work["id"] in ids


# ---------- Regression ----------
class TestAnvilRegression:
    def test_anvil_list_public_shape(self, user):
        r = requests.get(f"{BASE_URL}/api/anvil", headers=_auth(user["token"]), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "works" in body and isinstance(body["works"], list)
        assert "categories" in body

    def test_post_validation_missing_kind_defaults_story(self, user):
        # kind field has default "story" so this should work
        title = f"TEST default {uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/anvil",
            json={"title": title, "category": "General", "body": "A body of text."},
            headers=_auth(user["token"]),
            timeout=15,
        )
        assert r.status_code == 201

    def test_post_bad_kind_rejected(self, user):
        r = requests.post(
            f"{BASE_URL}/api/anvil",
            json={"title": "T", "kind": "poem", "body": "x"},
            headers=_auth(user["token"]),
            timeout=15,
        )
        # Either 400 (server logic) or 422 (validation) is acceptable rejection
        assert r.status_code in (400, 422), f"unexpected {r.status_code}: {r.text}"

    def test_applause_toggle(self, user):
        # Create a work then applause it
        r = requests.post(
            f"{BASE_URL}/api/anvil",
            json={"title": f"TEST applause {uuid.uuid4().hex[:6]}", "kind": "story", "category": "General", "body": "hi", "open_cowriting": False},
            headers=_auth(user["token"]),
            timeout=15,
        )
        assert r.status_code == 201
        wid = r.json()["id"]

        a1 = requests.post(f"{BASE_URL}/api/anvil/{wid}/applause", headers=_auth(user["token"]), timeout=15)
        assert a1.status_code == 200
        d1 = a1.json()
        assert d1.get("applauded") is True
        assert d1.get("applause", 0) >= 1

        a2 = requests.post(f"{BASE_URL}/api/anvil/{wid}/applause", headers=_auth(user["token"]), timeout=15)
        assert a2.status_code == 200
        assert a2.json().get("applauded") is False

    def test_cowriting_contribute(self, user, cowriter):
        # Author creates work open for co-writing; cowriter contributes
        c = requests.post(
            f"{BASE_URL}/api/anvil",
            json={"title": f"TEST cowrite {uuid.uuid4().hex[:6]}", "kind": "story", "category": "General", "body": "Opening line.", "open_cowriting": True},
            headers=_auth(user["token"]),
            timeout=15,
        )
        assert c.status_code == 201
        wid = c.json()["id"]

        contrib = requests.post(
            f"{BASE_URL}/api/anvil/{wid}/contribute",
            json={"body": "A quiet second paragraph."},
            headers=_auth(cowriter["token"]),
            timeout=15,
        )
        assert contrib.status_code == 201, f"{contrib.status_code}: {contrib.text}"
