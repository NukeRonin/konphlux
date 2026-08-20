"""Answerfier (Q&A) feature tests: QOTD, questions, answers, votes, best-answer."""
import os
import uuid
from datetime import date

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures: fresh users ----------
def _register(display_name: str):
    email = f"test_af_{display_name.lower()}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "steam123", "display_name": f"TEST_{display_name}"
    }, timeout=20)
    assert r.status_code == 201, r.text
    body = r.json()
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {body['access_token']}"})
    return {"s": s, "user": body["user"]}


@pytest.fixture(scope="module")
def asker():
    return _register("Asker")


@pytest.fixture(scope="module")
def other():
    return _register("Other")


@pytest.fixture(scope="module")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_question(asker):
    """Module-scoped: a fresh question authored by `asker` used by dependent tests."""
    payload = {"title": "TEST_ shared question for dependent tests",
               "body": "TEST_ shared body", "category": "Craft & Making"}
    r = asker["s"].post(f"{API}/answerfier/questions", json=payload, timeout=20)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture(scope="module")
def created_answer(other, created_question):
    """Module-scoped: an answer on `created_question` authored by `other`."""
    qid = created_question["id"]
    r = other["s"].post(f"{API}/answerfier/questions/{qid}/answers",
                        json={"body": "TEST_ shared answer body"}, timeout=20)
    assert r.status_code == 201, r.text
    return r.json()


# ---------- Board / QOTD ----------
class TestBoardAndQOTD:
    def test_board_requires_auth(self, anon):
        r = anon.get(f"{API}/answerfier", timeout=20)
        assert r.status_code in (401, 403)

    def test_board_shape(self, asker):
        r = asker["s"].get(f"{API}/answerfier", timeout=20)
        assert r.status_code == 200
        data = r.json()
        for key in ("qotd", "questions", "categories"):
            assert key in data
        # QOTD structure
        q = data["qotd"]
        assert q["category"] == "Question of the Day"
        assert q["is_qotd"] is True
        assert q.get("user_id") is None
        assert q["is_author"] is False
        for k in ("id", "title", "answer_count", "total_upvotes"):
            assert k in q
        # No _id leakage anywhere
        assert "_id" not in q
        for x in data["questions"]:
            assert "_id" not in x
            assert x.get("category") != "Question of the Day"
        # Categories excludes QOTD
        assert "Question of the Day" not in data["categories"]
        # Seed sample categories present
        for c in ("General", "Craft & Making", "Science", "Life & Advice"):
            assert c in data["categories"]

    def test_qotd_idempotent_same_day(self, asker):
        r1 = asker["s"].get(f"{API}/answerfier", timeout=20).json()
        r2 = asker["s"].get(f"{API}/answerfier", timeout=20).json()
        # Same qotd id and text on repeated calls in the same UTC day
        assert r1["qotd"]["id"] == r2["qotd"]["id"]
        assert r1["qotd"]["title"] == r2["qotd"]["title"]
        assert r1["qotd"]["qotd_date"] == r2["qotd"]["qotd_date"]
        assert r1["qotd"]["qotd_date"] == date.today().isoformat()

    def test_qotd_endpoint_matches_board(self, asker):
        r_board = asker["s"].get(f"{API}/answerfier", timeout=20).json()
        r_qotd = asker["s"].get(f"{API}/answerfier/qotd", timeout=20).json()
        assert r_qotd["id"] == r_board["qotd"]["id"]
        assert r_qotd["title"] == r_board["qotd"]["title"]

    def test_qotd_pool_no_repeat_property(self):
        """Import-level check: _QOTD_POOL has >=1000 unique entries."""
        import sys
        sys.path.insert(0, "/app/backend")
        from server import _QOTD_POOL, _qotd_text_for  # type: ignore
        assert len(_QOTD_POOL) == len(set(_QOTD_POOL))
        assert len(_QOTD_POOL) >= 1000
        # spot-check 1000-day window uniqueness
        from datetime import date as _date, timedelta
        start = _date(2026, 1, 1)
        seen = [_qotd_text_for(start + timedelta(days=i)) for i in range(1000)]
        assert len(set(seen)) == 1000


# ---------- Questions CRUD ----------
class TestQuestions:
    def test_create_question_authored_by_caller(self, asker):
        payload = {"title": "TEST_ how do I temper a brass gear?",
                   "body": "TEST body content",
                   "category": "Craft & Making"}
        r = asker["s"].post(f"{API}/answerfier/questions", json=payload, timeout=20)
        assert r.status_code == 201, r.text
        q = r.json()
        assert q["title"] == payload["title"]
        assert q["author"] == asker["user"]["display_name"]
        assert q["user_id"] == asker["user"]["id"]
        assert q["category"] == "Craft & Making"
        assert q["is_qotd"] is False
        assert q["is_author"] is True
        assert q["answer_count"] == 0
        assert "_id" not in q

    def test_create_question_short_title_422(self, asker):
        r = asker["s"].post(f"{API}/answerfier/questions", json={
            "title": "abc", "body": "x", "category": "General"
        }, timeout=20)
        assert r.status_code == 422

    def test_create_question_invalid_category_falls_back_to_general(self, asker):
        r = asker["s"].post(f"{API}/answerfier/questions", json={
            "title": "TEST_ this is a valid title please", "body": "x", "category": "Bogus"
        }, timeout=20)
        assert r.status_code == 201
        assert r.json()["category"] == "General"

    def test_create_question_qotd_category_not_allowed(self, asker):
        r = asker["s"].post(f"{API}/answerfier/questions", json={
            "title": "TEST_ trying to hijack QOTD category",
            "body": "x", "category": "Question of the Day"
        }, timeout=20)
        assert r.status_code == 201  # accepted but coerced
        assert r.json()["category"] == "General"

    def test_question_detail_shape(self, asker, created_question):
        qid = created_question["id"]
        r = asker["s"].get(f"{API}/answerfier/questions/{qid}", timeout=20)
        assert r.status_code == 200
        q = r.json()
        assert q["id"] == qid
        assert q["is_author"] is True
        assert isinstance(q["answers"], list)
        assert "_id" not in q

    def test_question_detail_404(self, asker):
        r = asker["s"].get(f"{API}/answerfier/questions/does-not-exist", timeout=20)
        assert r.status_code == 404

    def test_seed_question_answers_sorted_best_then_upvotes(self, asker):
        # q1 has best_answer_id=a2, and a2 has upvotes=34, a1 has upvotes=12
        r = asker["s"].get(f"{API}/answerfier/questions/q1", timeout=20)
        assert r.status_code == 200
        answers = r.json()["answers"]
        assert len(answers) >= 2
        assert answers[0]["id"] == "a2"  # best first
        assert answers[0]["is_best"] is True
        # then remaining sorted by upvotes desc
        rest = answers[1:]
        upvotes = [a["upvotes"] for a in rest]
        assert upvotes == sorted(upvotes, reverse=True)


# ---------- Answers, votes, best ----------
class TestAnswersVotesBest:
    def test_add_answer_appears_in_detail(self, other, created_question, created_answer):
        qid = created_question["id"]
        a = created_answer
        assert a["author"] == other["user"]["display_name"]
        assert a["body"] == "TEST_ shared answer body"
        assert a["upvotes"] == 0
        assert a["voted"] is False
        assert a["is_best"] is False
        assert "_id" not in a

        # detail now includes it and answer_count incremented
        det = other["s"].get(f"{API}/answerfier/questions/{qid}", timeout=20).json()
        assert any(x["id"] == a["id"] for x in det["answers"])
        assert det["answer_count"] >= 1

    def test_answer_on_unknown_question_404(self, asker):
        r = asker["s"].post(f"{API}/answerfier/questions/nope/answers",
                            json={"body": "x"}, timeout=20)
        assert r.status_code == 404

    def test_vote_toggle_idempotent(self, asker, created_answer):
        aid = created_answer["id"]
        # Vote by asker (a different user than the answer's author 'other')
        r1 = asker["s"].post(f"{API}/answerfier/answers/{aid}/vote", timeout=20)
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["voted"] is True
        assert d1["upvotes"] >= 1

        # Second vote by same user un-votes it
        r2 = asker["s"].post(f"{API}/answerfier/answers/{aid}/vote", timeout=20)
        d2 = r2.json()
        assert d2["voted"] is False
        assert d2["upvotes"] == d1["upvotes"] - 1

    def test_vote_unknown_answer_404(self, asker):
        r = asker["s"].post(f"{API}/answerfier/answers/does-not-exist/vote", timeout=20)
        assert r.status_code == 404

    def test_best_answer_only_asker(self, asker, other, created_question, created_answer):
        qid = created_question["id"]
        aid = created_answer["id"]
        # other (not the asker) cannot mark best
        r_forbidden = other["s"].post(f"{API}/answerfier/questions/{qid}/best",
                                      json={"answer_id": aid}, timeout=20)
        assert r_forbidden.status_code == 403

        # asker sets best
        r_ok = asker["s"].post(f"{API}/answerfier/questions/{qid}/best",
                               json={"answer_id": aid}, timeout=20)
        assert r_ok.status_code == 200
        assert r_ok.json()["best_answer_id"] == aid

        # Verify persisted + best-answer is first in detail
        det = asker["s"].get(f"{API}/answerfier/questions/{qid}", timeout=20).json()
        assert det["best_answer_id"] == aid
        assert det["answers"][0]["id"] == aid
        assert det["answers"][0]["is_best"] is True

        # toggling same answer clears it
        r_toggle = asker["s"].post(f"{API}/answerfier/questions/{qid}/best",
                                   json={"answer_id": aid}, timeout=20)
        assert r_toggle.status_code == 200
        assert r_toggle.json()["best_answer_id"] is None
        det2 = asker["s"].get(f"{API}/answerfier/questions/{qid}", timeout=20).json()
        assert det2["best_answer_id"] is None

    def test_best_answer_on_qotd_forbidden(self, asker):
        # Grab today's QOTD id
        qotd = asker["s"].get(f"{API}/answerfier/qotd", timeout=20).json()
        qotd_id = qotd["id"]
        # Add an answer to QOTD (should be allowed for any user)
        ra = asker["s"].post(f"{API}/answerfier/questions/{qotd_id}/answers",
                             json={"body": "TEST_ answering the QOTD"}, timeout=20)
        assert ra.status_code == 201, ra.text
        aid = ra.json()["id"]
        # Since QOTD has user_id=None, no user matches -> 403 for any caller
        r_best = asker["s"].post(f"{API}/answerfier/questions/{qotd_id}/best",
                                 json={"answer_id": aid}, timeout=20)
        assert r_best.status_code == 403

    def test_can_answer_qotd(self, other):
        qotd = other["s"].get(f"{API}/answerfier/qotd", timeout=20).json()
        qid = qotd["id"]
        r = other["s"].post(f"{API}/answerfier/questions/{qid}/answers",
                            json={"body": "TEST_ other answering QOTD"}, timeout=20)
        assert r.status_code == 201
        # confirm shows in detail
        det = other["s"].get(f"{API}/answerfier/questions/{qid}", timeout=20).json()
        assert any(a["body"] == "TEST_ other answering QOTD" for a in det["answers"])


# ---------- Auth guard on write endpoints ----------
class TestAuthGuards:
    def test_create_question_requires_auth(self, anon):
        r = anon.post(f"{API}/answerfier/questions",
                      json={"title": "TEST_ some title long enough", "body": "x"}, timeout=20)
        assert r.status_code in (401, 403)

    def test_answer_requires_auth(self, anon):
        r = anon.post(f"{API}/answerfier/questions/q1/answers",
                      json={"body": "x"}, timeout=20)
        assert r.status_code in (401, 403)

    def test_vote_requires_auth(self, anon):
        r = anon.post(f"{API}/answerfier/answers/a1/vote", timeout=20)
        assert r.status_code in (401, 403)
