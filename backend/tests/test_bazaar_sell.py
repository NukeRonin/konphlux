"""Bazaar selling side: image upload, fixed listings, auctions, bidding, cart guards."""
import io
import os
import uuid
import pytest
import requests

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


def _register():
    tag = uuid.uuid4().hex[:10]
    email = f"TEST_{tag}@example.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "steam123", "display_name": f"Tester {tag[:4]}"},
        timeout=30,
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"], r.json()["user"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# 1x1 red PNG
_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\xa0T\x9dO\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture(scope="module")
def user_a():
    tok, u = _register()
    return {"token": tok, "user": u}


@pytest.fixture(scope="module")
def user_b():
    tok, u = _register()
    return {"token": tok, "user": u}


# ---------------- Image upload ----------------
class TestImageUpload:
    def test_upload_png_and_serve(self, user_a):
        files = {"file": ("t.png", io.BytesIO(_PNG), "image/png")}
        r = requests.post(f"{BASE_URL}/api/bazaar/upload", headers=_auth(user_a["token"]), files=files, timeout=60)
        assert r.status_code == 201, r.text
        path = r.json()["path"]
        assert path.startswith("konphlux/uploads/")
        # Public file endpoint
        r2 = requests.get(f"{BASE_URL}/api/files/{path}", timeout=60)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")
        assert len(r2.content) > 0

    def test_upload_rejects_non_image(self, user_a):
        files = {"file": ("t.txt", io.BytesIO(b"hello"), "text/plain")}
        r = requests.post(f"{BASE_URL}/api/bazaar/upload", headers=_auth(user_a["token"]), files=files, timeout=60)
        assert r.status_code == 400, r.text

    def test_upload_rejects_oversize(self, user_a):
        big = b"x" * (9 * 1024 * 1024)
        files = {"file": ("t.png", io.BytesIO(big), "image/png")}
        r = requests.post(f"{BASE_URL}/api/bazaar/upload", headers=_auth(user_a["token"]), files=files, timeout=120)
        assert r.status_code == 413, r.text


def _upload_image(token):
    files = {"file": ("t.png", io.BytesIO(_PNG), "image/png")}
    r = requests.post(f"{BASE_URL}/api/bazaar/upload", headers=_auth(token), files=files, timeout=60)
    assert r.status_code == 201, r.text
    return f"{BASE_URL}/api/files/{r.json()['path']}"


# ---------------- Fixed listing ----------------
class TestFixedListing:
    def test_create_fixed(self, user_a):
        img = _upload_image(user_a["token"])
        payload = {
            "title": "TEST Brass Widget",
            "description": "A fine test widget",
            "category": "Tools",
            "image": img,
            "kind": "fixed",
            "price_cents": 4200,
        }
        r = requests.post(f"{BASE_URL}/api/bazaar", headers=_auth(user_a["token"]), json=payload, timeout=30)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["is_auction"] is False
        assert d["kind"] == "fixed"
        assert d["price_cents"] == 4200
        assert d["seller_id"] == user_a["user"]["id"]
        assert d["is_seller"] is True
        # GET verifies persistence
        r2 = requests.get(f"{BASE_URL}/api/bazaar/{d['id']}", headers=_auth(user_a["token"]), timeout=30)
        assert r2.status_code == 200
        assert r2.json()["id"] == d["id"]


# ---------------- Auction listing ----------------
class TestAuctionListing:
    def test_create_auction(self, user_a):
        img = _upload_image(user_a["token"])
        payload = {
            "title": "TEST Auction Lot",
            "description": "Rare bidding item",
            "category": "Instruments",
            "image": img,
            "kind": "auction",
            "starting_price_cents": 1000,
            "duration_hours": 24,
        }
        r = requests.post(f"{BASE_URL}/api/bazaar", headers=_auth(user_a["token"]), json=payload, timeout=30)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["is_auction"] is True
        assert d["kind"] == "auction"
        assert d["ended"] is False
        assert d["seconds_left"] > 0
        assert d.get("starting_price_cents") == 1000
        assert d.get("current_bid_cents") in (None, 0)
        assert "ends_at" in d
        assert d["seller_id"] == user_a["user"]["id"]

    def test_auction_missing_fields(self, user_a):
        img = _upload_image(user_a["token"])
        # Missing starting_price and duration
        r = requests.post(
            f"{BASE_URL}/api/bazaar",
            headers=_auth(user_a["token"]),
            json={"title": "TEST Bad", "description": "x", "category": "Tools", "image": img, "kind": "auction"},
            timeout=30,
        )
        assert r.status_code == 400, r.text


# ---------------- Browse ----------------
class TestBrowse:
    def test_categories_include_books(self, user_a):
        r = requests.get(f"{BASE_URL}/api/bazaar", headers=_auth(user_a["token"]), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "eBooks" in d["categories"]
        assert "Audio Books" in d["categories"]
        # book ids should exist
        ids = {l["id"] for l in d["listings"]}
        assert "e1" in ids
        assert "a-b1" in ids
        # listings include auction fields
        for l in d["listings"]:
            assert "is_auction" in l
            assert "kind" in l


# ---------------- Mine + delete ----------------
class TestMineAndDelete:
    def test_mine_only_returns_own(self, user_a, user_b):
        img = _upload_image(user_a["token"])
        r = requests.post(
            f"{BASE_URL}/api/bazaar",
            headers=_auth(user_a["token"]),
            json={"title": "TEST Mine A", "description": "d", "category": "Tools", "image": img, "kind": "fixed", "price_cents": 500},
            timeout=30,
        )
        a_id = r.json()["id"]
        # user_b mine should NOT include a_id
        r2 = requests.get(f"{BASE_URL}/api/bazaar/mine", headers=_auth(user_b["token"]), timeout=30)
        assert r2.status_code == 200
        assert a_id not in {x["id"] for x in r2.json()}
        # user_a mine SHOULD
        r3 = requests.get(f"{BASE_URL}/api/bazaar/mine", headers=_auth(user_a["token"]), timeout=30)
        assert a_id in {x["id"] for x in r3.json()}

    def test_delete_403_for_other_user(self, user_a, user_b):
        img = _upload_image(user_a["token"])
        r = requests.post(
            f"{BASE_URL}/api/bazaar",
            headers=_auth(user_a["token"]),
            json={"title": "TEST Del", "description": "d", "category": "Tools", "image": img, "kind": "fixed", "price_cents": 500},
            timeout=30,
        )
        item_id = r.json()["id"]
        r2 = requests.delete(f"{BASE_URL}/api/bazaar/{item_id}", headers=_auth(user_b["token"]), timeout=30)
        assert r2.status_code == 403

    def test_delete_owner_removes(self, user_a):
        img = _upload_image(user_a["token"])
        r = requests.post(
            f"{BASE_URL}/api/bazaar",
            headers=_auth(user_a["token"]),
            json={"title": "TEST DelMe", "description": "d", "category": "Tools", "image": img, "kind": "fixed", "price_cents": 500},
            timeout=30,
        )
        item_id = r.json()["id"]
        r2 = requests.delete(f"{BASE_URL}/api/bazaar/{item_id}", headers=_auth(user_a["token"]), timeout=30)
        assert r2.status_code == 200
        assert r2.json()["deleted"] is True
        # Vanishes from mine
        r3 = requests.get(f"{BASE_URL}/api/bazaar/mine", headers=_auth(user_a["token"]), timeout=30)
        assert item_id not in {x["id"] for x in r3.json()}
        # Vanishes from bazaar
        r4 = requests.get(f"{BASE_URL}/api/bazaar", headers=_auth(user_a["token"]), timeout=30)
        assert item_id not in {x["id"] for x in r4.json()["listings"]}
        # 404 on GET
        r5 = requests.get(f"{BASE_URL}/api/bazaar/{item_id}", headers=_auth(user_a["token"]), timeout=30)
        assert r5.status_code == 404


# ---------------- Bidding ----------------
class TestBidding:
    @pytest.fixture(scope="class")
    def auction(self, user_a):
        img = _upload_image(user_a["token"])
        r = requests.post(
            f"{BASE_URL}/api/bazaar",
            headers=_auth(user_a["token"]),
            json={"title": "TEST Bid Lot", "description": "d", "category": "Tools", "image": img, "kind": "auction", "starting_price_cents": 1000, "duration_hours": 24},
            timeout=30,
        )
        assert r.status_code == 201
        return r.json()

    def test_below_starting_400(self, user_b, auction):
        r = requests.post(f"{BASE_URL}/api/bazaar/{auction['id']}/bid", headers=_auth(user_b["token"]), json={"amount_cents": 500}, timeout=30)
        assert r.status_code == 400

    def test_seller_cannot_bid(self, user_a, auction):
        r = requests.post(f"{BASE_URL}/api/bazaar/{auction['id']}/bid", headers=_auth(user_a["token"]), json={"amount_cents": 1500}, timeout=30)
        assert r.status_code == 400

    def test_valid_first_bid(self, user_b, auction):
        r = requests.post(f"{BASE_URL}/api/bazaar/{auction['id']}/bid", headers=_auth(user_b["token"]), json={"amount_cents": 1200}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["current_bid_cents"] == 1200
        assert d["bid_count"] == 1
        assert d["highest_bidder_name"] == user_b["user"]["display_name"]

    def test_next_bid_must_beat_by_100(self, user_b, auction):
        # must beat current 1200 by at least 100 -> 1300
        r = requests.post(f"{BASE_URL}/api/bazaar/{auction['id']}/bid", headers=_auth(user_b["token"]), json={"amount_cents": 1250}, timeout=30)
        assert r.status_code == 400
        r2 = requests.post(f"{BASE_URL}/api/bazaar/{auction['id']}/bid", headers=_auth(user_b["token"]), json={"amount_cents": 1300}, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["current_bid_cents"] == 1300


# ---------------- Cart guards ----------------
class TestCartGuards:
    def test_running_auction_cannot_be_carted(self, user_a, user_b):
        img = _upload_image(user_a["token"])
        r = requests.post(
            f"{BASE_URL}/api/bazaar",
            headers=_auth(user_a["token"]),
            json={"title": "TEST Cart Auction", "description": "d", "category": "Tools", "image": img, "kind": "auction", "starting_price_cents": 500, "duration_hours": 24},
            timeout=30,
        )
        item_id = r.json()["id"]
        r2 = requests.post(f"{BASE_URL}/api/cart", headers=_auth(user_b["token"]), json={"item_id": item_id, "qty": 1}, timeout=30)
        assert r2.status_code == 400

    def test_seller_cant_cart_own_fixed(self, user_a):
        img = _upload_image(user_a["token"])
        r = requests.post(
            f"{BASE_URL}/api/bazaar",
            headers=_auth(user_a["token"]),
            json={"title": "TEST Own Fixed", "description": "d", "category": "Tools", "image": img, "kind": "fixed", "price_cents": 500},
            timeout=30,
        )
        item_id = r.json()["id"]
        r2 = requests.post(f"{BASE_URL}/api/cart", headers=_auth(user_a["token"]), json={"item_id": item_id, "qty": 1}, timeout=30)
        assert r2.status_code == 400

    def test_other_user_can_cart_fixed(self, user_a, user_b):
        img = _upload_image(user_a["token"])
        r = requests.post(
            f"{BASE_URL}/api/bazaar",
            headers=_auth(user_a["token"]),
            json={"title": "TEST Fixed OK", "description": "d", "category": "Tools", "image": img, "kind": "fixed", "price_cents": 500},
            timeout=30,
        )
        item_id = r.json()["id"]
        r2 = requests.post(f"{BASE_URL}/api/cart", headers=_auth(user_b["token"]), json={"item_id": item_id, "qty": 1}, timeout=30)
        assert r2.status_code == 200
        assert any(i["item_id"] == item_id for i in r2.json()["items"])
