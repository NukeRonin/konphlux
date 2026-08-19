"""Roundtable feature tests: communities, threads, votes, replies (per-user)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def user_a():
    email = f"test_rt_a_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "brass-gauge-42", "display_name": "TEST_Ada"
    }, timeout=20)
    assert r.status_code == 201, r.text
    body = r.json()
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {body['access_token']}"})
    return {"s": s, "user": body["user"]}


@pytest.fixture(scope="module")
def user_b():
    email = f"test_rt_b_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "brass-gauge-42", "display_name": "TEST_Bea"
    }, timeout=20)
    assert r.status_code == 201, r.text
    body = r.json()
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {body['access_token']}"})
    return {"s": s, "user": body["user"]}


@pytest.fixture(scope="module")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestCommunities:
    def test_list_requires_auth(self, anon):
        r = anon.get(f"{API}/roundtable/communities", timeout=20)
        assert r.status_code in (401, 403)

    def test_list_communities_shape(self, user_a):
        r = user_a["s"].get(f"{API}/roundtable/communities", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 4
        ids = [c["id"] for c in data]
        for seed in ("c1", "c2", "c3", "c4"):
            assert seed in ids
        for c in data:
            assert "_id" not in c
            for k in ("id", "name", "icon", "members", "description", "member", "thread_count"):
                assert k in c

    def test_community_detail_seeded(self, user_a):
        r = user_a["s"].get(f"{API}/roundtable/communities/c1", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "c1" and d["name"] == "The Forge Floor"
        assert isinstance(d["threads"], list)
        assert isinstance(d["member"], bool)

    def test_community_detail_404(self, user_a):
        r = user_a["s"].get(f"{API}/roundtable/communities/does-not-exist", timeout=20)
        assert r.status_code == 404

    def test_join_toggle_updates_member_count_per_user(self, user_a):
        # baseline
        r0 = user_a["s"].get(f"{API}/roundtable/communities/c1", timeout=20).json()
        assert r0["member"] is False
        baseline = r0["members"]

        # join
        r = user_a["s"].post(f"{API}/roundtable/communities/c1/join", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["member"] is True and d["members"] == baseline + 1

        # verify persisted via GET
        r2 = user_a["s"].get(f"{API}/roundtable/communities/c1", timeout=20).json()
        assert r2["member"] is True and r2["members"] == baseline + 1

        # leave
        r = user_a["s"].post(f"{API}/roundtable/communities/c1/join", timeout=20)
        assert r.json()["member"] is False
        r3 = user_a["s"].get(f"{API}/roundtable/communities/c1", timeout=20).json()
        assert r3["member"] is False and r3["members"] == baseline

    def test_create_community_authored_by_user(self, user_a):
        payload = {"name": "TEST_Coilworkers", "description": "TEST community", "icon": "anvil"}
        r = user_a["s"].post(f"{API}/roundtable/communities", json=payload, timeout=20)
        assert r.status_code == 201, r.text
        c = r.json()
        assert c["name"] == payload["name"]
        assert c["icon"] == "anvil"
        assert c["member"] is True  # creator auto-joined
        assert c["members"] == 1
        assert "_id" not in c
        pytest.rt_new_comm_id = c["id"]

        # verify appears in list and detail
        r2 = user_a["s"].get(f"{API}/roundtable/communities/{c['id']}", timeout=20)
        assert r2.status_code == 200
        assert r2.json()["name"] == payload["name"]

    def test_create_community_validation(self, user_a):
        r = user_a["s"].post(f"{API}/roundtable/communities",
                             json={"name": "a", "description": "x"}, timeout=20)
        assert r.status_code == 422  # name < 2


class TestThreads:
    def test_list_threads_seeded(self, user_a):
        r = user_a["s"].get(f"{API}/roundtable/threads", timeout=20)
        assert r.status_code == 200
        threads = r.json()
        ids = [t["id"] for t in threads]
        for seed in ("t1", "t2", "t3", "t4"):
            assert seed in ids
        for t in threads:
            for k in ("id", "title", "body", "author", "upvotes", "voted",
                      "reply_count", "community_id", "community_name"):
                assert k in t

    def test_thread_detail_with_replies(self, user_a):
        r = user_a["s"].get(f"{API}/roundtable/threads/t3", timeout=20)
        assert r.status_code == 200
        t = r.json()
        assert t["id"] == "t3"
        assert t["community_name"] == "Parlour Debates"
        assert isinstance(t["replies"], list)
        # seeded r3 belongs to t3
        assert any(r["body"].startswith("Bold words") for r in t["replies"])

    def test_thread_detail_404(self, user_a):
        r = user_a["s"].get(f"{API}/roundtable/threads/nope", timeout=20)
        assert r.status_code == 404

    def test_vote_toggle_per_user(self, user_a, user_b):
        # both users start unvoted on t2
        t0 = user_a["s"].get(f"{API}/roundtable/threads/t2", timeout=20).json()
        baseline = t0["upvotes"]
        assert t0["voted"] is False

        # A votes
        r = user_a["s"].post(f"{API}/roundtable/threads/t2/vote", timeout=20)
        assert r.status_code == 200
        dA = r.json()
        assert dA["voted"] is True and dA["upvotes"] == baseline + 1

        # B still sees voted=False (per-user), but count = baseline+1
        tB = user_b["s"].get(f"{API}/roundtable/threads/t2", timeout=20).json()
        assert tB["voted"] is False
        assert tB["upvotes"] == baseline + 1

        # A un-votes
        r = user_a["s"].post(f"{API}/roundtable/threads/t2/vote", timeout=20)
        assert r.json()["voted"] is False
        tA2 = user_a["s"].get(f"{API}/roundtable/threads/t2", timeout=20).json()
        assert tA2["upvotes"] == baseline

    def test_create_thread_authored_by_user(self, user_a):
        cid = getattr(pytest, "rt_new_comm_id", "c1")
        payload = {"community_id": cid, "title": "TEST_ thread title",
                   "body": "TEST_ body content for the thread."}
        r = user_a["s"].post(f"{API}/roundtable/threads", json=payload, timeout=20)
        assert r.status_code == 201, r.text
        t = r.json()
        assert t["author"] == user_a["user"]["display_name"]
        assert t["title"] == payload["title"]
        assert t["upvotes"] == 0 and t["voted"] is False
        assert t["reply_count"] == 0
        assert "_id" not in t
        pytest.rt_new_thread_id = t["id"]

        # appears in list
        threads = user_a["s"].get(f"{API}/roundtable/threads", timeout=20).json()
        assert t["id"] in [x["id"] for x in threads]

    def test_create_thread_in_unknown_community_404(self, user_a):
        r = user_a["s"].post(f"{API}/roundtable/threads", json={
            "community_id": "does-not-exist", "title": "TEST_", "body": "b"
        }, timeout=20)
        assert r.status_code == 404


class TestReplies:
    def test_add_reply_appears_and_bumps_count(self, user_a):
        tid = getattr(pytest, "rt_new_thread_id", "t1")
        before = user_a["s"].get(f"{API}/roundtable/threads/{tid}", timeout=20).json()
        before_count = before["reply_count"]

        r = user_a["s"].post(f"{API}/roundtable/threads/{tid}/replies",
                             json={"body": "TEST_ reply from A"}, timeout=20)
        assert r.status_code == 201, r.text
        reply = r.json()
        assert reply["author"] == user_a["user"]["display_name"]
        assert reply["body"] == "TEST_ reply from A"
        assert "_id" not in reply

        after = user_a["s"].get(f"{API}/roundtable/threads/{tid}", timeout=20).json()
        assert after["reply_count"] == before_count + 1
        assert any(x["body"] == "TEST_ reply from A" for x in after["replies"])

    def test_reply_on_unknown_thread_404(self, user_a):
        r = user_a["s"].post(f"{API}/roundtable/threads/nope/replies",
                             json={"body": "hi"}, timeout=20)
        assert r.status_code == 404

    def test_reply_requires_auth(self, anon):
        r = anon.post(f"{API}/roundtable/threads/t1/replies",
                      json={"body": "hi"}, timeout=20)
        assert r.status_code in (401, 403)
