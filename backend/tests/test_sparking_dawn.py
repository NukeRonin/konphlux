"""Sparking Dawn (dating) backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env constant (kept generic, not a secret)
    BASE_URL = "https://web-to-mobile-252.preview.emergentagent.com"

API = f"{BASE_URL}/api"

LIKES_BACK = {"spark-1", "spark-2", "spark-4", "spark-5", "spark-7", "spark-8", "spark-10"}
NO_LIKE_BACK = {"spark-3", "spark-6", "spark-9"}


def _reg(prefix="sd"):
    """Register a fresh user and return (token, user_id)."""
    email = f"{prefix}_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "steam123",
                            "display_name": f"Tester {prefix}"},
                      timeout=15)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data["user"]["id"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Discover ----------
class TestDiscover:
    def test_discover_women_only(self):
        tok, _ = _reg("dw")
        r = requests.get(f"{API}/dating/discover?seeking=woman", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        cards = r.json()
        assert isinstance(cards, list) and len(cards) > 0
        assert all(c["gender"] == "woman" for c in cards), [c["gender"] for c in cards]

    def test_discover_men_only(self):
        tok, _ = _reg("dm")
        r = requests.get(f"{API}/dating/discover?seeking=man", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        cards = r.json()
        assert len(cards) > 0
        assert all(c["gender"] == "man" for c in cards)

    def test_discover_all_mix(self):
        tok, _ = _reg("da")
        r = requests.get(f"{API}/dating/discover?seeking=all", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        cards = r.json()
        genders = {c["gender"] for c in cards}
        # Expect at least both men and women in the seeded set
        assert "man" in genders and "woman" in genders, genders

    def test_discover_excludes_swiped(self):
        tok, _ = _reg("dx")
        cards = requests.get(f"{API}/dating/discover?seeking=all", headers=_hdr(tok), timeout=15).json()
        assert cards
        tid = cards[0]["id"]
        r = requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                          json={"target_id": tid, "action": "pass"}, timeout=15)
        assert r.status_code == 200
        again = requests.get(f"{API}/dating/discover?seeking=all", headers=_hdr(tok), timeout=15).json()
        assert tid not in {c["id"] for c in again}


# ---------- Swipe ----------
class TestSwipe:
    def test_like_likes_back_creates_match(self):
        tok, _ = _reg("lb")
        r = requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                          json={"target_id": "spark-1", "action": "like"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["match"] is True
        assert body["profile"]["id"] == "spark-1"
        assert body["profile"]["display_name"]

    def test_like_no_likes_back_no_match(self):
        tok, _ = _reg("nlb")
        r = requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                          json={"target_id": "spark-3", "action": "like"}, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"match": False}

    def test_pass_returns_no_match_and_excludes(self):
        tok, _ = _reg("ps")
        r = requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                          json={"target_id": "spark-6", "action": "pass"}, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"match": False}
        cards = requests.get(f"{API}/dating/discover?seeking=all", headers=_hdr(tok), timeout=15).json()
        assert "spark-6" not in {c["id"] for c in cards}

    def test_swipe_on_self_400(self):
        tok, uid = _reg("self")
        r = requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                          json={"target_id": uid, "action": "like"}, timeout=15)
        assert r.status_code == 400

    def test_swipe_unknown_action_400(self):
        tok, _ = _reg("ua")
        r = requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                          json={"target_id": "spark-1", "action": "sniff"}, timeout=15)
        assert r.status_code == 400

    def test_all_likes_back_seeds_create_matches(self):
        tok, _ = _reg("full")
        for sid in LIKES_BACK:
            r = requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                              json={"target_id": sid, "action": "like"}, timeout=15)
            assert r.status_code == 200 and r.json()["match"] is True, sid

    def test_all_no_like_back_seeds_no_match(self):
        tok, _ = _reg("nolb")
        for sid in NO_LIKE_BACK:
            r = requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                              json={"target_id": sid, "action": "like"}, timeout=15)
            assert r.status_code == 200 and r.json()["match"] is False, sid


# ---------- Real mutual match ----------
class TestMutualMatch:
    def test_two_real_users_mutual_like(self):
        tok_a, uid_a = _reg("ua")
        tok_b, uid_b = _reg("ub")

        # A likes B first -> no match yet
        r1 = requests.post(f"{API}/dating/swipe", headers=_hdr(tok_a),
                           json={"target_id": uid_b, "action": "like"}, timeout=15)
        assert r1.status_code == 200
        assert r1.json()["match"] is False

        # B likes A back -> match
        r2 = requests.post(f"{API}/dating/swipe", headers=_hdr(tok_b),
                           json={"target_id": uid_a, "action": "like"}, timeout=15)
        assert r2.status_code == 200
        j2 = r2.json()
        assert j2["match"] is True
        assert j2["profile"]["id"] == uid_a

        # matches list on both sides
        m_a = requests.get(f"{API}/dating/matches", headers=_hdr(tok_a), timeout=15).json()
        m_b = requests.get(f"{API}/dating/matches", headers=_hdr(tok_b), timeout=15).json()
        assert any(m["id"] == uid_b for m in m_a), m_a
        assert any(m["id"] == uid_a for m in m_b), m_b


# ---------- Profile ----------
class TestProfile:
    def test_me_null_before_save_then_persist(self):
        tok, _ = _reg("me")
        r = requests.get(f"{API}/dating/me", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        assert r.json() is None

        payload = {"gender": "woman", "seeking": ["man", "nonbinary"],
                   "bio": "  Airship rider  ", "tagline": " brass & fire ", "age": 29, "photo": ""}
        s = requests.post(f"{API}/dating/profile", headers=_hdr(tok),
                          json=payload, timeout=15)
        assert s.status_code == 200
        sd = s.json()
        assert sd["gender"] == "woman"
        assert sd["seeking"] == ["man", "nonbinary"]
        assert sd["bio"] == "Airship rider"
        assert sd["tagline"] == "brass & fire"
        assert sd["age"] == 29

        r2 = requests.get(f"{API}/dating/me", headers=_hdr(tok), timeout=15).json()
        assert r2 is not None
        assert r2["gender"] == "woman"
        assert r2["age"] == 29

    def test_invalid_gender_400(self):
        tok, _ = _reg("ig")
        r = requests.post(f"{API}/dating/profile", headers=_hdr(tok),
                          json={"gender": "airship", "seeking": ["man"], "bio": "x", "tagline": "y", "age": 20, "photo": ""},
                          timeout=15)
        assert r.status_code == 400


# ---------- Matches ----------
class TestMatchesList:
    def test_matches_include_seeded_likes_back(self):
        tok, _ = _reg("ml")
        # Like two likes_back seeds
        for sid in ("spark-2", "spark-5"):
            requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                          json={"target_id": sid, "action": "like"}, timeout=15)
        r = requests.get(f"{API}/dating/matches", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()]
        assert "spark-2" in ids and "spark-5" in ids
        # Each match has photo + name + matched_at
        for m in r.json():
            assert m.get("display_name")
            assert "matched_at" in m

    def test_matches_sorted_desc(self):
        tok, _ = _reg("srt")
        requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                      json={"target_id": "spark-4", "action": "like"}, timeout=15)
        requests.post(f"{API}/dating/swipe", headers=_hdr(tok),
                      json={"target_id": "spark-7", "action": "like"}, timeout=15)
        matches = requests.get(f"{API}/dating/matches", headers=_hdr(tok), timeout=15).json()
        ts = [m.get("matched_at", "") for m in matches]
        assert ts == sorted(ts, reverse=True)
