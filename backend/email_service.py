"""Emergent-managed transactional email (order receipts) for Konphlux.

Recipients come from server-side records and bodies from server-side templates
only (never caller input). See the email guardrails in the integration playbook.
"""
import os
import re
import ipaddress
import logging
import httpx
from pathlib import Path
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger("konphlux.email")

# Emergent managed email proxy. This is a CONSTANT — never read it from os.environ.
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Konphlux")  # this app's OWN brand (G1)
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def _send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY missing; skipping email send")
        return None
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:  # noqa: BLE001
        logger.error(f"Email send error: {e}")
        return None


def _money(cents: int) -> str:
    return "$" + f"{cents / 100:,.2f}"


async def send_order_receipt(*, to: str, name: str, order: dict) -> str | None:
    """Build a receipt from the server-side order record and send it."""
    order_ref = escape(str(order.get("id", ""))[:8].upper())
    rows = ""
    for line in order.get("lines", []):
        rows += (
            f'<tr>'
            f'<td style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#3B3229">'
            f'{escape(str(line.get("title","")))} <span style="color:#8A7A63">x{int(line.get("qty",1))}</span></td>'
            f'<td align="right" style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#3B3229">'
            f'{escape(_money(int(line.get("unit_amount",0)) * int(line.get("qty",1))))}</td>'
            f'</tr>'
        )
    total = escape(_money(int(order.get("amount_cents", 0))))
    subject = f"Your {EMAIL_FROM_NAME} order {order_ref} is confirmed"
    html = (
        '<table role="presentation" width="100%" style="background:#F6F1E7;padding:24px">'
        '<tr><td align="center">'
        '<table role="presentation" width="480" style="background:#FCF9F2;border:1px solid #DDD2BE;'
        'border-radius:14px;padding:28px;font-family:Arial,sans-serif">'
        f'<tr><td style="font-family:Georgia,serif;font-size:24px;color:#B06C3A;padding-bottom:6px">{escape(EMAIL_FROM_NAME)}</td></tr>'
        f'<tr><td style="font-size:15px;color:#3B3229;padding-bottom:4px">Thank you, {escape(name)} — your order is confirmed.</td></tr>'
        f'<tr><td style="font-size:13px;color:#8A7A63;padding-bottom:16px">Order reference: <strong>{order_ref}</strong></td></tr>'
        '<tr><td><table role="presentation" width="100%" style="border-top:1px solid #E4DBCD;border-bottom:1px solid #E4DBCD;margin:4px 0">'
        f'{rows}'
        '</table></td></tr>'
        '<tr><td align="right" style="padding-top:14px;font-family:Georgia,serif;font-size:18px;color:#B06C3A">'
        f'Total paid: {total}</td></tr>'
        '<tr><td style="padding-top:22px;font-size:12px;color:#8A7A63;line-height:1.5">'
        f'You are receiving this because you made a purchase in the {escape(EMAIL_FROM_NAME)} Bazaar. '
        f'{escape(EMAIL_FROM_NAME)} will never ask for your password or card details by email.</td></tr>'
        '</table></td></tr></table>'
    )
    return await _send_email(to=to, subject=subject, html=html)



# Fixed server-side recipient for Contact Us — never taken from caller input.
CONTACT_INBOX = "konphluxoverlord@gmail.com"


async def send_contact_message(*, username: str, email: str, subject: str, message: str, topic: str = "Other") -> str | None:
    """Deliver a Contact Us submission to the Konphlux inbox. All user-supplied
    fields are escaped and placed into a fixed server-side template."""
    safe_topic = topic.strip() if topic.strip() in ("Bug", "Idea", "Billing", "Other") else "Other"
    safe_subject = f"[Konphlux Contact · {safe_topic}] {subject.strip()[:120]}"
    body_html = escape(message.strip()).replace("\n", "<br>")
    html = (
        '<table role="presentation" width="100%" style="background:#F6F1E7;padding:24px">'
        '<tr><td align="center">'
        '<table role="presentation" width="520" style="background:#FCF9F2;border:1px solid #DDD2BE;'
        'border-radius:14px;padding:28px;font-family:Arial,sans-serif">'
        f'<tr><td style="font-family:Georgia,serif;font-size:22px;color:#B06C3A;padding-bottom:10px">New Contact Message</td></tr>'
        f'<tr><td style="font-size:14px;color:#3B3229;padding-bottom:4px"><strong>Topic:</strong> {escape(safe_topic)}</td></tr>'
        f'<tr><td style="font-size:14px;color:#3B3229;padding-bottom:4px"><strong>From:</strong> {escape(username.strip())}</td></tr>'
        f'<tr><td style="font-size:14px;color:#3B3229;padding-bottom:4px"><strong>Email:</strong> {escape(email.strip())}</td></tr>'
        f'<tr><td style="font-size:14px;color:#3B3229;padding-bottom:12px"><strong>Subject:</strong> {escape(subject.strip())}</td></tr>'
        '<tr><td style="border-top:1px solid #E4DBCD;padding-top:14px;font-size:15px;color:#3B3229;line-height:1.6">'
        f'{body_html}</td></tr>'
        '</table></td></tr></table>'
    )
    return await _send_email(to=CONTACT_INBOX, subject=safe_subject, html=html)


async def send_contact_confirmation(*, to: str, name: str, subject: str) -> str | None:
    """Friendly auto-reply confirming a Contact Us submission was received.
    Fixed server-side template — no caller-controlled HTML."""
    safe_subject = f"We received your message — {EMAIL_FROM_NAME}"
    html = (
        '<table role="presentation" width="100%" style="background:#F6F1E7;padding:24px">'
        '<tr><td align="center">'
        '<table role="presentation" width="480" style="background:#FCF9F2;border:1px solid #DDD2BE;'
        'border-radius:14px;padding:28px;font-family:Arial,sans-serif">'
        f'<tr><td style="font-family:Georgia,serif;font-size:24px;color:#B06C3A;padding-bottom:8px">{escape(EMAIL_FROM_NAME)}</td></tr>'
        f'<tr><td style="font-size:16px;color:#3B3229;padding-bottom:12px">Thank you, {escape(name.strip())} — we\u2019ve received your message.</td></tr>'
        '<tr><td style="font-size:14px;color:#3B3229;line-height:1.6;padding-bottom:12px">'
        f'Your note about \u201c<strong>{escape(subject.strip())}</strong>\u201d has landed safely with our team. '
        'We read every message and will get back to you by email as soon as we can.</td></tr>'
        '<tr><td style="font-size:13px;color:#8A7A63;line-height:1.5;padding-top:6px;border-top:1px solid #E4DBCD">'
        f'This is an automated confirmation from {escape(EMAIL_FROM_NAME)}. There\u2019s no need to reply. '
        f'{escape(EMAIL_FROM_NAME)} will never ask for your password or card details by email.</td></tr>'
        '</table></td></tr></table>'
    )
    return await _send_email(to=to, subject=safe_subject, html=html)
