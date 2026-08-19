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



# ---- 2026-06 filters: ?filter=joined on communities, ?mine=true on threads ----

@pytest.fixture(scope="module")
def user_c():
    """Fresh user with NO joins / NO authored threads, for empty-state assertions."""
    email = f"test_rt_c_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "brass-gauge-42", "display_name": "TEST_Cee"
    }, timeout=20)
    assert r.status_code == 201, r.text
    body = r.json()
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {body['access_token']}"})
    return {"s": s, "user": body["user"]}


class TestCommunitiesJoinedFilter:
    def test_joined_filter_empty_for_new_user(self, user_c):
        r = user_c["s"].get(f"{API}/roundtable/communities?filter=joined", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert data == []  # brand-new user has joined nothing

    def test_all_filter_regression_returns_seeds(self, user_c):
        r = user_c["s"].get(f"{API}/roundtable/communities", timeout=20)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        for seed in ("c1", "c2", "c3", "c4"):
            assert seed in ids

    def test_joined_filter_reflects_join(self, user_c):
        # Baseline: joined list is empty
        joined0 = user_c["s"].get(f"{API}/roundtable/communities?filter=joined", timeout=20).json()
        assert joined0 == []
        # Join c2
        rj = user_c["s"].post(f"{API}/roundtable/communities/c2/join", timeout=20)
        assert rj.status_code == 200 and rj.json()["member"] is True
        # Now joined list has exactly c2
        joined1 = user_c["s"].get(f"{API}/roundtable/communities?filter=joined", timeout=20).json()
        assert isinstance(joined1, list) and len(joined1) == 1
        assert joined1[0]["id"] == "c2"
        assert joined1[0]["member"] is True
        assert "_id" not in joined1[0]
        # All-list still includes c2 (regression + member flag)
        all_list = user_c["s"].get(f"{API}/roundtable/communities", timeout=20).json()
        c2_in_all = next(c for c in all_list if c["id"] == "c2")
        assert c2_in_all["member"] is True
        # Leave c2 -> joined empty again
        user_c["s"].post(f"{API}/roundtable/communities/c2/join", timeout=20)
        joined2 = user_c["s"].get(f"{API}/roundtable/communities?filter=joined", timeout=20).json()
        assert joined2 == []

    def test_joined_filter_isolated_per_user(self, user_c):
        """user_c joining c3 must not affect a different user's joined list."""
        # Register a peer user_d inline
        email = f"test_rt_d_{uuid.uuid4().hex[:8]}@example.com"
        rr = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "brass-gauge-42", "display_name": "TEST_Dee"
        }, timeout=20)
        assert rr.status_code == 201
        d_token = rr.json()["access_token"]
        d_s = requests.Session()
        d_s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {d_token}"})

        # user_c joins c3
        rj = user_c["s"].post(f"{API}/roundtable/communities/c3/join", timeout=20)
        assert rj.status_code == 200 and rj.json()["member"] is True

        # user_d joined list is still empty
        d_joined = d_s.get(f"{API}/roundtable/communities?filter=joined", timeout=20).json()
        assert d_joined == []

        # user_c joined list contains c3
        c_joined = user_c["s"].get(f"{API}/roundtable/communities?filter=joined", timeout=20).json()
        assert [c["id"] for c in c_joined] == ["c3"]

        # cleanup: user_c leaves c3
        user_c["s"].post(f"{API}/roundtable/communities/c3/join", timeout=20)

    def test_unknown_filter_falls_back_to_all(self, user_c):
        """Unknown filter values must not crash; server treats them as no-filter."""
        r = user_c["s"].get(f"{API}/roundtable/communities?filter=bogus", timeout=20)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        for seed in ("c1", "c2", "c3", "c4"):
            assert seed in ids


class TestThreadsMineFilter:
    def test_mine_empty_for_new_user(self, user_c):
        r = user_c["s"].get(f"{API}/roundtable/threads?mine=true", timeout=20)
        assert r.status_code == 200
        assert r.json() == []

    def test_mine_reflects_authored_thread(self, user_c):
        # Create a community owned by user_c, then a thread in it
        cr = user_c["s"].post(f"{API}/roundtable/communities", json={
            "name": "TEST_Cee_Community", "description": "TEST for mine=true", "icon": "forum"
        }, timeout=20)
        assert cr.status_code == 201
        cid = cr.json()["id"]

        tr = user_c["s"].post(f"{API}/roundtable/threads", json={
            "community_id": cid, "title": "TEST_ mine=true thread",
            "body": "TEST_ body content that is long enough."
        }, timeout=20)
        assert tr.status_code == 201
        tid = tr.json()["id"]

        mine = user_c["s"].get(f"{API}/roundtable/threads?mine=true", timeout=20).json()
        ids = [t["id"] for t in mine]
        assert tid in ids
        # And every thread in "mine" must be authored by this user's display name
        for t in mine:
            assert t["author"] == user_c["user"]["display_name"]
            assert "_id" not in t

    def test_mine_excludes_other_users_threads(self, user_a, user_c):
        """user_a's authored threads must NOT appear in user_c's mine=true list."""
        # Ensure user_a has at least one authored thread (create fresh one)
        cr = user_a["s"].post(f"{API}/roundtable/communities", json={
            "name": f"TEST_Iso_{uuid.uuid4().hex[:6]}", "description": "iso", "icon": "forum"
        }, timeout=20)
        assert cr.status_code == 201
        a_cid = cr.json()["id"]
        ar = user_a["s"].post(f"{API}/roundtable/threads", json={
            "community_id": a_cid, "title": "TEST_ A owned thread",
            "body": "TEST_ body content that is long enough."
        }, timeout=20)
        assert ar.status_code == 201
        a_tid = ar.json()["id"]

        # user_c's mine list must NOT contain user_a's thread
        c_mine = user_c["s"].get(f"{API}/roundtable/threads?mine=true", timeout=20).json()
        c_mine_ids = [t["id"] for t in c_mine]
        assert a_tid not in c_mine_ids
        # And user_a's mine=true DOES contain it
        a_mine = user_a["s"].get(f"{API}/roundtable/threads?mine=true", timeout=20).json()
        assert a_tid in [t["id"] for t in a_mine]

    def test_all_threads_regression_includes_seeds(self, user_c):
        r = user_c["s"].get(f"{API}/roundtable/threads", timeout=20)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        for seed in ("t1", "t2", "t3", "t4"):
            assert seed in ids

    def test_mine_false_returns_all(self, user_c):
        r = user_c["s"].get(f"{API}/roundtable/threads?mine=false", timeout=20)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        # seeded threads authored by fixtures show up
        for seed in ("t1", "t2", "t3", "t4"):
            assert seed in ids
