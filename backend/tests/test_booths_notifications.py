"""Bazaar enhancements: Booths (storefronts) + Outbid notifications."""
import io
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


# 1x1 png used by upload/listing image
_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\xa0T\x9dO\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _register():
    tag = uuid.uuid4().hex[:10]
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": f"TEST_{tag}@example.com",
            "password": "steam123",
            "display_name": f"Tester {tag[:4]}",
        },
        timeout=30,
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"], r.json()["user"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _upload_image(token):
    files = {"file": ("t.png", io.BytesIO(_PNG), "image/png")}
    r = requests.post(
        f"{BASE_URL}/api/bazaar/upload", headers=_auth(token), files=files, timeout=60
    )
    assert r.status_code == 201, r.text
    return f"{BASE_URL}/api/files/{r.json()['path']}"


def _create_listing(token, image, *, booth_id=None, title=None, price_cents=1000, kind="fixed", starting_price_cents=None, duration_hours=None):
    payload = {
        "title": title or f"TEST Item {uuid.uuid4().hex[:6]}",
        "description": "desc",
        "category": "Tools",
        "image": image,
        "kind": kind,
    }
    if kind == "fixed":
        payload["price_cents"] = price_cents
    else:
        payload["starting_price_cents"] = starting_price_cents or 1000
        payload["duration_hours"] = duration_hours or 24
    if booth_id:
        payload["booth_id"] = booth_id
    r = requests.post(f"{BASE_URL}/api/bazaar", headers=_auth(token), json=payload, timeout=30)
    return r


# ---------- Booths ----------
@pytest.fixture(scope="module")
def user_a():
    tok, u = _register()
    return {"token": tok, "user": u}


@pytest.fixture(scope="module")
def user_b():
    tok, u = _register()
    return {"token": tok, "user": u}


@pytest.fixture(scope="module")
def shared():
    return {}


class TestBooths:
    def test_create_booth_min_name(self, user_a):
        # too short (< 2)
        r = requests.post(
            f"{BASE_URL}/api/booths",
            headers=_auth(user_a["token"]),
            json={"name": "A", "description": "d"},
            timeout=30,
        )
        assert r.status_code in (400, 422), r.text

    def test_create_booth_ok(self, user_a, shared):
        r = requests.post(
            f"{BASE_URL}/api/booths",
            headers=_auth(user_a["token"]),
            json={"name": "TEST Brass Emporium", "description": "gears & gadgets"},
            timeout=30,
        )
        assert r.status_code == 201, r.text
        b = r.json()
        assert b["name"] == "TEST Brass Emporium"
        assert b["owner_id"] == user_a["user"]["id"]
        assert b["listing_count"] == 0
        assert "id" in b
        shared['booth_a_id'] = b["id"]

    def test_list_booths_includes_new(self, user_a, shared):
        r = requests.get(f"{BASE_URL}/api/booths", headers=_auth(user_a["token"]), timeout=30)
        assert r.status_code == 200
        ids = {b["id"] for b in r.json()}
        assert shared['booth_a_id'] in ids
        for b in r.json():
            assert "listing_count" in b

    def test_my_booths_only_mine(self, user_a, user_b, shared):
        r_a = requests.get(f"{BASE_URL}/api/booths/mine", headers=_auth(user_a["token"]), timeout=30)
        r_b = requests.get(f"{BASE_URL}/api/booths/mine", headers=_auth(user_b["token"]), timeout=30)
        assert r_a.status_code == 200 and r_b.status_code == 200
        a_ids = {b["id"] for b in r_a.json()}
        b_ids = {b["id"] for b in r_b.json()}
        assert shared['booth_a_id'] in a_ids
        assert shared['booth_a_id'] not in b_ids

    def test_booth_detail_shape(self, user_a, user_b, shared):
        r = requests.get(f"{BASE_URL}/api/booths/{shared['booth_a_id']}", headers=_auth(user_a["token"]), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == shared['booth_a_id']
        assert d["is_owner"] is True
        assert isinstance(d.get("listings", []), list)
        # non-owner
        r2 = requests.get(f"{BASE_URL}/api/booths/{shared['booth_a_id']}", headers=_auth(user_b["token"]), timeout=30)
        assert r2.status_code == 200
        assert r2.json()["is_owner"] is False


class TestListingBoothWiring:
    def test_individual_when_no_booth_id(self, user_a, shared):
        img = _upload_image(user_a["token"])
        r = _create_listing(user_a["token"], img, title="TEST solo item", price_cents=800)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d.get("listing_type") == "individual"
        assert d.get("booth_id") in (None, "")
        assert d.get("booth_name") in (None, "")
        shared['solo'] = d["id"]

    def test_booth_id_owned_ok(self, user_a, shared):
        img = _upload_image(user_a["token"])
        r1 = _create_listing(user_a["token"], img, booth_id=shared['booth_a_id'], title="TEST booth item 1", price_cents=1500)
        assert r1.status_code == 201, r1.text
        d1 = r1.json()
        assert d1["listing_type"] == "booth"
        assert d1["booth_id"] == shared['booth_a_id']
        assert d1["booth_name"] == "TEST Brass Emporium"
        img2 = _upload_image(user_a["token"])
        r2 = _create_listing(user_a["token"], img2, booth_id=shared['booth_a_id'], title="TEST booth item 2", price_cents=2500)
        assert r2.status_code == 201
        shared['booth_items'] = [d1["id"], r2.json()["id"]]

    def test_booth_id_not_owned_400(self, user_a, user_b, shared):
        img = _upload_image(user_b["token"])
        r = _create_listing(user_b["token"], img, booth_id=shared['booth_a_id'], title="TEST steal", price_cents=999)
        assert r.status_code == 400, r.text

    def test_booth_detail_shows_only_booth_items(self, user_a, shared):
        r = requests.get(f"{BASE_URL}/api/booths/{shared['booth_a_id']}", headers=_auth(user_a["token"]), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["listing_count"] == 2
        listing_ids = {l["id"] for l in d["listings"]}
        for lid in shared['booth_items']:
            assert lid in listing_ids
        # solo item must NOT appear
        assert shared['solo'] not in listing_ids


# ---------- Outbid notifications ----------
class TestOutbidNotifications:
    @pytest.fixture(scope="class")
    def cast(self):
        seller_tok, seller = _register()
        b1_tok, b1 = _register()
        b2_tok, b2 = _register()
        img_files = {"file": ("t.png", io.BytesIO(_PNG), "image/png")}
        r = requests.post(f"{BASE_URL}/api/bazaar/upload", headers=_auth(seller_tok), files=img_files, timeout=60)
        image_url = f"{BASE_URL}/api/files/{r.json()['path']}"
        r = _create_listing(seller_tok, image_url, kind="auction", starting_price_cents=1000, duration_hours=24, title="TEST Outbid Lot")
        assert r.status_code == 201, r.text
        return {
            "seller": (seller_tok, seller),
            "b1": (b1_tok, b1),
            "b2": (b2_tok, b2),
            "listing_id": r.json()["id"],
        }

    def test_first_bidder_no_self_notif(self, cast):
        b1_tok = cast["b1"][0]
        # unread count baseline
        r_pre = requests.get(f"{BASE_URL}/api/notifications/unread_count", headers=_auth(b1_tok), timeout=30)
        pre = r_pre.json()["count"]
        # b1 bids first (no prior highest bidder -> no notification)
        r = requests.post(
            f"{BASE_URL}/api/bazaar/{cast['listing_id']}/bid",
            headers=_auth(b1_tok),
            json={"amount_cents": 1200},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        r_post = requests.get(f"{BASE_URL}/api/notifications/unread_count", headers=_auth(b1_tok), timeout=30)
        assert r_post.json()["count"] == pre

    def test_outbid_notifies_previous_bidder(self, cast):
        b2_tok = cast["b2"][0]
        b1_tok = cast["b1"][0]
        # b2 outbids b1 (min +$1 = 100 cents, so use 1300)
        r = requests.post(
            f"{BASE_URL}/api/bazaar/{cast['listing_id']}/bid",
            headers=_auth(b2_tok),
            json={"amount_cents": 1300},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        # b1 has exactly 1 unread outbid notification
        r_uc = requests.get(f"{BASE_URL}/api/notifications/unread_count", headers=_auth(b1_tok), timeout=30)
        assert r_uc.status_code == 200
        assert r_uc.json()["count"] == 1
        r_list = requests.get(f"{BASE_URL}/api/notifications", headers=_auth(b1_tok), timeout=30)
        assert r_list.status_code == 200
        notifs = r_list.json()
        outbids = [n for n in notifs if n.get("type") == "outbid"]
        assert len(outbids) == 1
        n = outbids[0]
        assert n.get("read") is False
        assert n.get("listing_id") == cast["listing_id"]
        assert "outbid" in (n.get("body") or "").lower() or "outbid" in (n.get("title") or "").lower()
        # b2 has NO outbid notifications
        r_b2 = requests.get(f"{BASE_URL}/api/notifications/unread_count", headers=_auth(b2_tok), timeout=30)
        assert r_b2.json()["count"] == 0

    def test_mark_all_read(self, cast):
        b1_tok = cast["b1"][0]
        r = requests.post(f"{BASE_URL}/api/notifications/read", headers=_auth(b1_tok), timeout=30)
        assert r.status_code == 200
        r_uc = requests.get(f"{BASE_URL}/api/notifications/unread_count", headers=_auth(b1_tok), timeout=30)
        assert r_uc.json()["count"] == 0
        # notifications still exist, now read=true
        r_list = requests.get(f"{BASE_URL}/api/notifications", headers=_auth(b1_tok), timeout=30)
        outbids = [n for n in r_list.json() if n.get("type") == "outbid"]
        assert len(outbids) == 1
        assert outbids[0]["read"] is True


# ---------- Light bazaar regression ----------
class TestRegression:
    def test_browse_ok(self, user_a):
        r = requests.get(f"{BASE_URL}/api/bazaar", headers=_auth(user_a["token"]), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "listings" in d and "categories" in d

    def test_mine_ok(self, user_a):
        r = requests.get(f"{BASE_URL}/api/bazaar/mine", headers=_auth(user_a["token"]), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_fixed_and_delete(self, user_a):
        img = _upload_image(user_a["token"])
        r = _create_listing(user_a["token"], img, title="TEST regression fixed", price_cents=500)
        assert r.status_code == 201
        item_id = r.json()["id"]
        r_del = requests.delete(f"{BASE_URL}/api/bazaar/{item_id}", headers=_auth(user_a["token"]), timeout=30)
        assert r_del.status_code == 200

    def test_cart_guard_own_fixed(self, user_a):
        img = _upload_image(user_a["token"])
        r = _create_listing(user_a["token"], img, title="TEST regression cart", price_cents=500)
        assert r.status_code == 201
        item_id = r.json()["id"]
        r_cart = requests.post(f"{BASE_URL}/api/cart", headers=_auth(user_a["token"]), json={"item_id": item_id, "qty": 1}, timeout=30)
        assert r_cart.status_code == 400
