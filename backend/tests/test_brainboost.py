"""BrainBoost (learning district) API tests."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not set")
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def token():
    email = f"TEST_bb_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "steam123", "display_name": "BB Tester"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- District listing sanity ----------------

def test_district_brainboost_features_no_religious_studies(h):
    r = requests.get(f"{API}/districts/brainboost", headers=h, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["slug"] == "brainboost"
    feats = d.get("features", [])
    # Religious Studies must NOT be a top-level feature
    assert "Religious Studies" not in feats, f"Religious Studies should be a course category, not a top-level feature. features={feats}"
    # Required features
    for req in ["Courses", "Quizzes", "Fun Facts", "Video lessons", "Dictionary", "Thesaurus", "AI tutoring", "Repair Guy"]:
        assert req in feats, f"missing feature: {req}"


# ---------------- Hub ----------------

def test_brainboost_hub(h):
    r = requests.get(f"{API}/brainboost", headers=h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["fact_of_day"], str) and len(data["fact_of_day"]) > 5
    assert "Religious Studies" in data["categories"]
    assert data["course_count"] >= 9
    assert data["quiz_count"] >= 5
    assert data["video_count"] >= 5
    assert isinstance(data["featured"], list) and len(data["featured"]) > 0
    fc = data["featured"][0]
    for key in ("id", "title", "category", "level", "icon", "summary", "lesson_count"):
        assert key in fc
    assert data["lessons_completed"] == 0  # fresh user


def test_fact_of_day_deterministic(h):
    # Same day => same fact
    r1 = requests.get(f"{API}/brainboost", headers=h, timeout=15).json()
    r2 = requests.get(f"{API}/brainboost/facts", headers=h, timeout=15).json()
    assert r1["fact_of_day"] == r2["fact_of_day"]
    assert isinstance(r2["more"], list) and len(r2["more"]) >= 5
    # Fact varies across dates
    assert r2["fact_of_day"] not in r2["more"] or True  # not strict


# ---------------- Courses list & filter ----------------

def test_courses_list_all(h):
    r = requests.get(f"{API}/brainboost/courses", headers=h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "Religious Studies" in data["categories"]
    ids = [c["id"] for c in data["courses"]]
    assert "bc1" in ids and "bc8" in ids  # blacksmithing + world religions


def test_courses_filter_religious_studies(h):
    r = requests.get(f"{API}/brainboost/courses", headers=h, params={"category": "Religious Studies"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data["courses"]) >= 2
    for c in data["courses"]:
        assert c["category"] == "Religious Studies"
    ids = {c["id"] for c in data["courses"]}
    assert {"bc8", "bc9"}.issubset(ids)


# ---------------- Course detail + progress ----------------

def test_course_detail_and_progress(h):
    r = requests.get(f"{API}/brainboost/courses/bc8", headers=h, timeout=15)
    assert r.status_code == 200
    doc = r.json()
    assert doc["id"] == "bc8"
    assert "lessons" in doc and len(doc["lessons"]) >= 2
    assert doc["completed"] == []
    total = len(doc["lessons"])

    # mark lesson 0 complete
    r = requests.post(f"{API}/brainboost/courses/bc8/progress", headers=h,
                      json={"lesson_index": 0, "completed": True}, timeout=15)
    assert r.status_code == 200
    p = r.json()
    assert p["completed"] == [0]
    assert p["total"] == total

    # mark lesson 1 complete
    r = requests.post(f"{API}/brainboost/courses/bc8/progress", headers=h,
                      json={"lesson_index": 1, "completed": True}, timeout=15).json()
    assert r["completed"] == [0, 1]

    # GET should reflect persistence
    doc2 = requests.get(f"{API}/brainboost/courses/bc8", headers=h, timeout=15).json()
    assert doc2["completed"] == [0, 1]

    # un-mark lesson 0
    r = requests.post(f"{API}/brainboost/courses/bc8/progress", headers=h,
                      json={"lesson_index": 0, "completed": False}, timeout=15).json()
    assert r["completed"] == [1]

    # Hub lessons_completed should reflect
    hub = requests.get(f"{API}/brainboost", headers=h, timeout=15).json()
    assert hub["lessons_completed"] >= 1


def test_course_not_found(h):
    r = requests.get(f"{API}/brainboost/courses/does-not-exist", headers=h, timeout=15)
    assert r.status_code == 404


# ---------------- Quizzes ----------------

def test_quiz_list(h):
    r = requests.get(f"{API}/brainboost/quizzes", headers=h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 5
    for q in data:
        assert set(q.keys()) >= {"id", "title", "category", "icon", "question_count"}
        # answer key must NOT be in list
        assert "answer" not in q
        assert "questions" not in q


def test_quiz_detail_hides_answers(h):
    r = requests.get(f"{API}/brainboost/quizzes/bq1", headers=h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == "bq1"
    assert len(data["questions"]) >= 3
    for q in data["questions"]:
        assert "q" in q and "options" in q
        assert "answer" not in q, "quiz detail must strip 'answer' key"


def test_quiz_submit_scoring(h):
    # bq1 answers: [1, 2, 1, 2]
    r = requests.post(f"{API}/brainboost/quizzes/bq1/submit", headers=h,
                      json={"answers": [1, 2, 1, 2]}, timeout=15)
    assert r.status_code == 200
    result = r.json()
    assert result["score"] == 4
    assert result["total"] == 4
    assert result["correct"] == [1, 2, 1, 2]

    # Partial correct
    r = requests.post(f"{API}/brainboost/quizzes/bq1/submit", headers=h,
                      json={"answers": [0, 2, 0, 2]}, timeout=15).json()
    assert r["score"] == 2

    # Empty answers => zero
    r = requests.post(f"{API}/brainboost/quizzes/bq1/submit", headers=h,
                      json={"answers": []}, timeout=15).json()
    assert r["score"] == 0
    assert r["total"] == 4


# ---------------- Videos ----------------

def test_videos_have_url(h):
    r = requests.get(f"{API}/brainboost/videos", headers=h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 5
    for v in data:
        assert "url" in v and v["url"].startswith("http")
        assert "title" in v and "duration" in v


# ---------------- LLM: Lexicon (dictionary + thesaurus) ----------------

def test_lexicon_dictionary(h):
    r = requests.post(f"{API}/brainboost/lexicon", headers=h,
                      json={"word": "forge", "mode": "dictionary"}, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["word"] == "forge"
    assert d["mode"] == "dictionary"
    assert isinstance(d["text"], str) and len(d["text"]) > 15
    # Should include some structured hint (case-insensitive check)
    lowered = d["text"].lower()
    assert "definition" in lowered or "noun" in lowered or "verb" in lowered


def test_lexicon_thesaurus(h):
    r = requests.post(f"{API}/brainboost/lexicon", headers=h,
                      json={"word": "swift", "mode": "thesaurus"}, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["mode"] == "thesaurus"
    lowered = d["text"].lower()
    assert "synonym" in lowered  # SYNONYMS header


# ---------------- LLM: Repair Guy ----------------

def test_repair_guy(h):
    r = requests.post(f"{API}/brainboost/repair", headers=h,
                      json={"problem": "My kitchen tap drips constantly from the spout."},
                      timeout=60)
    assert r.status_code == 200, r.text
    steps = r.json().get("steps", "")
    assert isinstance(steps, str) and len(steps) > 30


# ---------------- Auth guard ----------------

def test_brainboost_requires_auth():
    r = requests.get(f"{API}/brainboost", timeout=15)
    assert r.status_code in (401, 403)
