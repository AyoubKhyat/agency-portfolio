"""Real-database check of the confirmed-send flow. Fictional data only.

Drives the real production build in a browser, then reads the database to prove
what was written, to whom, and that nobody else changed. No message can be sent:
the app has no sending integration, and this browser answers every outside
address with a blank page.

It wipes the tables it uses, so it refuses to run unless:
  - LEADS_TEST_DATABASE_URL is set and is not the host in .env or .env.production
  - every prospect, lead and user already there is one this script created

Build the app, serve it on port 3300 with DATABASE_URL set to the same disposable
address, then run:
    python tests/integration/db_check.py [scenario ...]
"""
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

import psycopg2
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LEADS_TEST_BASE", "http://127.0.0.1:3300")
URL = os.environ.get("LEADS_TEST_DATABASE_URL", "")
ROOT = Path(__file__).resolve().parents[2]
PW = "fictional-test-password-" + str(int(time.time()))
TEAM = {"owner": "owner@it.example.test", "member": "member@it.example.test", "former": "former@it.example.test"}


def stop(msg):
    print("REFUSED: " + msg)
    sys.exit(2)


def production_hosts():
    hosts = set()
    for name in (".env", ".env.production"):
        try:
            found = re.search(r'^DATABASE_URL=["\']?([^"\'\r\n]+)', (ROOT / name).read_text(encoding="utf-8"), re.M)
        except OSError:
            continue
        if found:
            hosts.add(urlparse(found.group(1)).hostname)
    return hosts


if not URL:
    stop("LEADS_TEST_DATABASE_URL is not set")
if urlparse(URL).hostname in production_hosts():
    stop("the test address is the production database")

db = psycopg2.connect(URL)
db.autocommit = True


def q(sql, *args):
    with db.cursor() as c:
        c.execute(sql, args or None)
        return c.fetchall() if c.description else None


foreign = q("""select (select count(*) from prospects where id not like 'it-%')
                    + (select count(*) from leads where id not like 'it-%')
                    + (select count(*) from users where email not like '%example.test')""")[0][0]
if foreign:
    stop(f"{foreign} records here were not created by a test, so this is not a disposable database")

fails = []
passed = 0
WRITES = set()  # requests still on their way


def check(name, ok, detail=""):
    global passed
    print(("PASS " if ok else "FAIL ") + name, "" if ok else str(detail)[:300], flush=True)
    if ok:
        passed += 1
    else:
        fails.append(name)


def hash_password():
    code = "console.log(require('bcryptjs').hashSync(process.argv[1], 4))"
    return subprocess.run(["node", "-e", code, PW], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


HASH = hash_password()
TODAY = q("select to_char(now() at time zone 'Africa/Casablanca','YYYY-MM-DD')")[0][0]


def day(n):
    return q("select to_char(%s::date + %s::int, 'YYYY-MM-DD')", TODAY, n)[0][0]


def prospect(key, status="A_ENVOYER", wa="VERIFIED", ig="UNVERIFIED", score=90, sent=None, follow=None):
    q("""insert into prospects (id, name, phone, whatsapp_link, sector, neighborhood, instagram, status, whatsapp_status,
            instagram_status, score, sent_at, follow_up_date, updated_at)
         values (%s, %s, '0600000000', %s, 'Riad', 'Gueliz', %s, %s, %s, %s, %s, %s::timestamp, %s::timestamp, now())""",
      f"it-{key}", f"IT {key.capitalize()}", f"https://wa.me/00000{abs(hash(key)) % 9999}", f"it_{key}_fictional",
      status, wa, ig, score, sent, follow)
    q("update prospects set quality_label = 'HOT' where id = %s", f"it-{key}")
    return f"it-{key}"


def message(pid, sent, replied=False, reason=None):
    q("""insert into outreach_messages (id, prospect_id, channel, body, sent_at, sent_by_name, replied, replied_at, reply_reason)
         values (%s, %s, 'WHATSAPP', 'seeded', %s::timestamp, 'Seed', %s, %s::timestamp, %s)""",
      f"it-m-{pid}-{sent}", pid, sent, replied, sent if replied else None, reason)


def activity(pid, action, prev, new, at):
    q("""insert into prospect_activities (id, prospect_id, user_id, user_name, action_type, previous_status, new_status, created_at)
         values (%s, %s, 'it-user-owner', 'Seed', %s, %s, %s, %s::timestamp)""", f"it-a-{pid}-{action}", pid, action, prev, new, at)


def seed():
    """A fresh world: one of every kind of prospect the flow must respect."""
    q("""truncate prospects, leads, users, admin_users, notifications, audit_logs, outreach_messages, prospect_activities,
         prospect_notes, meetings, proposals cascade""")
    for role_key, role in (("owner", "admin"), ("member", "sales"), ("former", "sales")):
        q("""insert into users (id, full_name, email, password_hash, role, avatar_initials, is_active, updated_at)
             values (%s, %s, %s, %s, %s, 'IT', %s, now())""",
          f"it-user-{role_key}", f"IT {role_key}", TEAM[role_key], HASH, role, role_key != "former")
        q("insert into admin_users (id, email, password_hash, name, updated_at) values (%s, %s, %s, %s, now())",
          f"it-admin-{role_key}", TEAM[role_key], HASH, f"IT {role_key}")
    prospect("alpha", ig="VERIFIED")
    prospect("beta", ig="VERIFIED")
    prospect("kappa")
    gamma = prospect("gamma", "ENVOYE", sent=f"{day(-6)} 10:00", follow=f"{day(-1)} 00:00")
    message(gamma, f"{day(-6)} 10:00")
    iota = prospect("iota", "ENVOYE", sent=f"{day(-9)} 10:00", follow=f"{day(-2)} 00:00")
    message(iota, f"{day(-9)} 10:00")
    delta = prospect("delta", "REPONDU", sent=f"{day(-5)} 10:00")
    message(delta, f"{day(-5)} 10:00", replied=True, reason="INTERESTED")
    eps = prospect("epsilon", "MEETING", sent=f"{day(-8)} 10:00")
    q("""insert into meetings (id, title, prospect_id, start_at, updated_at) values ('it-meet', 'IT meeting', %s, now() + interval '2 days', now())""", eps)
    zeta = prospect("zeta", "PROPOSAL_SENT", sent=f"{day(-8)} 10:00")
    q("""insert into proposals (id, prospect_id, services, amount, status, created_by_id, created_by_name, updated_at)
         values ('it-prop', %s, 'Website', 1000, 'SENT', 'it-user-owner', 'Seed', now())""", zeta)
    eta = prospect("eta", "ENVOYE", sent=f"{day(-1)} 10:00", follow=f"{day(10)} 00:00")
    message(eta, f"{day(-1)} 10:00")
    theta = prospect("theta", "ENVOYE", sent=f"{day(-40)} 10:00", follow=f"{day(-30)} 00:00")
    activity(theta, "SENT_INSTAGRAM", "REPONDU", "ENVOYE", f"{day(-40)} 10:00")
    q("insert into prospect_notes (id, prospect_id, content) values ('it-note', %s, 'A seeded note that must survive')", theta)
    q("""insert into leads (id, full_name, email, subject, message, status, updated_at)
         values ('it-lead', 'IT Enquirer', 'enquirer@it.example.test', 'Website', 'Fictional enquiry', 'NEW', now())""")


def world():
    """Everything the flow may touch, so any unexpected change anywhere shows up."""
    out = {}
    for row in q("""select p.id, p.status, p.sent_at::text, p.follow_up_date::text, p.followup_1_at::text, p.followup_2_at::text,
                    (select count(*) from outreach_messages m where m.prospect_id = p.id),
                    (select count(*) from prospect_activities a where a.prospect_id = p.id),
                    (select count(*) from outreach_messages m where m.prospect_id = p.id and m.replied)
                    from prospects p"""):
        out[row[0]] = dict(status=row[1], sent=row[2], follow=row[3], f1=row[4], f2=row[5], msgs=row[6], acts=row[7], replied=row[8])
    return out


def changed(before):
    now = world()
    return sorted(k for k in now if now[k] != before.get(k))


def seeded_history_intact():
    rows = q("""select (select count(*) from outreach_messages where id like 'it-m-%'),
                       (select count(*) from prospect_activities where id like 'it-a-%'),
                       (select count(*) from prospect_notes where id = 'it-note'),
                       (select count(*) from meetings where id = 'it-meet'),
                       (select count(*) from proposals where id = 'it-prop')""")[0]
    return rows == (4, 1, 1, 1, 1)


def activities(pid):
    return [r[0] for r in q("select action_type from prospect_activities where prospect_id = %s order by created_at", pid)]


class Api:
    """Plain HTTP, with no browser and so no client-side protection."""

    def __init__(self, p):
        self.req = p.request.new_context(base_url=BASE)
        self.ip = 0

    def login(self, who):
        self.ip += 1
        r = self.req.post("/api/admin/login", data={"email": TEAM[who], "password": PW}, headers={"x-forwarded-for": f"10.1.{time.time_ns() % 250}.{self.ip}"})
        header = next((h["value"] for h in r.headers_array if h["name"].lower() == "set-cookie" and "admin_token" in h["value"]), "")
        return r.status, header.split(";")[0].split("=", 1)[1] if header else ""

    def call(self, method, path, token="", data=None):
        headers = {"cookie": f"admin_token={token}" if token else "", "content-type": "application/json"}
        return self.req.fetch(path, method=method, headers=headers, data=json.dumps(data) if data is not None else None)


def browser_ctx(b, token, width=1366, height=900, mobile=False):
    WRITES.clear()
    c = b.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile)
    outside = []

    def route(r):
        host = urlparse(r.request.url).hostname or ""
        if host in ("127.0.0.1", "localhost"):
            return r.fallback()
        outside.append(host)
        r.fulfill(status=200, content_type="text/html", body="<title>blank</title>")

    c.route("**/*", route)
    if token:
        c.add_cookies([{"name": "admin_token", "value": token, "url": BASE}])
    c.outside = outside
    c.on("request", lambda r: WRITES.add(r) if "/api/" in r.url and r.method != "GET" else None)
    c.on("requestfinished", lambda r: WRITES.discard(r))
    c.on("requestfailed", lambda r: WRITES.discard(r))
    return c


def hero(pg):
    return pg.locator('section[aria-label="Next action"]')


def open_queue(pg):
    pg.goto(BASE + "/admin/lead-queue", wait_until="domcontentloaded", timeout=120000)
    hero(pg).locator("h2").wait_for(timeout=60000)


def pick(pg, name):
    if name in hero(pg).locator("h2").inner_text():
        return
    pg.locator('aside[aria-label="Up next"] button').filter(has_text=name).first.click()
    pg.wait_for_function("n => document.querySelector('section[aria-label=\"Next action\"] h2').innerText.includes(n)", arg=name, timeout=15000)


def open_channel(c, pg, label="Open WhatsApp", tap=False):
    with c.expect_page() as popup:
        link = hero(pg).get_by_role("link", name=label)
        link.tap() if tap else link.click()
    popup.value.close()
    hero(pg).get_by_role("button", name="Yes, sent").wait_for(timeout=10000)


def settle(pg, ms=1200):
    """Wait for every write to finish. A send is several requests, one after the other, and each takes a moment."""
    pg.wait_for_timeout(300)
    quiet, deadline = 0, time.time() + 30
    while quiet < ms and time.time() < deadline:
        pg.wait_for_timeout(100)
        quiet = 0 if WRITES else quiet + 100


# ─── Scenarios ───────────────────────────────────────────────────────────

def s_auth(p, b, api):
    seed()
    before = world()
    a = "/api/admin/prospecting/it-alpha"
    for name, method, path, body in (
        ("queue", "GET", "/api/admin/lead-queue", None),
        ("prospect read", "GET", a, None),
        ("send record", "POST", a + "/outreach", {"channel": "WHATSAPP", "body": "x"}),
        ("status", "PATCH", a, {"status": "ENVOYE", "actionType": "SENT_WHATSAPP"}),
        ("follow-up step", "PATCH", a + "/sequence", {"step": "followup1", "done": True}),
        ("delete", "DELETE", a, None),
    ):
        check(f"auth: signed out, {name} refused", api.call(method, path, "", body).status == 401)
        check(f"auth: forged cookie, {name} refused", api.call(method, path, "not.a.token", body).status == 401)
    check("auth: refused calls wrote nothing", changed(before) == [])

    status, _ = api.login("former")
    check("auth: inactive account cannot sign in", status == 403, status)
    status, _ = api.login("owner")
    check("auth: active account can sign in", status == 200, status)
    bad = api.req.post("/api/admin/login", data={"email": TEAM["owner"], "password": "wrong"}, headers={"x-forwarded-for": "10.9.9.9"})
    check("auth: wrong password refused", bad.status == 401, bad.status)

    _, member = api.login("member")
    check("auth: team member can read the queue", api.call("GET", "/api/admin/lead-queue", member).status == 200)
    check("auth: team member cannot delete a prospect", api.call("DELETE", a, member).status == 403)
    check("auth: prospect still there", "it-alpha" in world())

    q("update users set is_active = false where id = 'it-user-member'")
    check("auth: deactivating ends an open session at once", api.call("GET", "/api/admin/lead-queue", member).status == 401)
    q("update users set is_active = true where id = 'it-user-member'")

    _, owner = api.login("owner")
    before = world()
    for name, method, path, body in (
        ("unknown prospect", "POST", "/api/admin/prospecting/it-nobody/outreach", {"channel": "WHATSAPP", "body": "x"}),
        ("bad channel", "POST", a + "/outreach", {"channel": "PIGEON", "body": "x"}),
        ("empty body", "POST", a + "/outreach", {"channel": "WHATSAPP", "body": ""}),
    ):
        r = api.call(method, path, owner, body)
        check(f"auth: {name} rejected", r.status >= 400, r.status)
    api.call("PATCH", a, owner, {"actionType": "SENT_WHATSAPP"})
    check("auth: a send activity cannot be logged without a status change", activities("it-alpha") == [], activities("it-alpha"))
    check("auth: rejected calls wrote nothing", changed(before) == [], changed(before))
    check("auth: no stray message rows", q("select count(*) from outreach_messages where prospect_id = 'it-nobody'")[0][0] == 0)

    c = browser_ctx(b, "")
    pg = c.new_page()
    leaks = []
    pg.on("response", lambda r: leaks.append(r.url) if "/api/admin/lead-queue" in r.url and r.status == 200 else None)
    pg.goto(BASE + "/admin/lead-queue", wait_until="domcontentloaded")
    pg.wait_for_timeout(2500)
    text = pg.locator("body").inner_text()
    check("auth: signed-out page shows no prospect", "IT Alpha" not in text and "IT Delta" not in text and not leaks, text[:120])
    c.close()


def s_open(p, b, api):
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token)
    pg = c.new_page()
    open_queue(pg)
    before = world()

    pick(pg, "IT Alpha")
    open_channel(c, pg)
    settle(pg)
    check("open: opening WhatsApp writes nothing", changed(before) == [], changed(before))
    check("open: the outside page was only the stub", set(c.outside) <= {"wa.me", "ig.me", "www.instagram.com", "api.whatsapp.com"}, c.outside)
    hero(pg).get_by_role("button", name="Not sent").click()
    settle(pg, 500)
    check("open: Not sent writes nothing", changed(before) == [], changed(before))

    open_channel(c, pg, "Open Instagram") if hero(pg).get_by_role("link", name="Open Instagram").count() else None
    settle(pg)
    check("open: opening Instagram writes nothing", changed(before) == [], changed(before))

    pg.reload(wait_until="domcontentloaded")
    hero(pg).locator("h2").wait_for(timeout=60000)
    settle(pg)
    check("open: refreshing before answering writes nothing", changed(before) == [], changed(before))
    pick(pg, "IT Alpha")
    check("open: the prospect is still waiting after a refresh", "IT Alpha" in hero(pg).locator("h2").inner_text())
    check("open: the question does not reappear by itself", hero(pg).get_by_role("button", name="Yes, sent").count() == 0)

    open_channel(c, pg)
    pick(pg, "IT Beta")
    settle(pg, 400)
    check("open: moving on drops the question", hero(pg).get_by_role("button", name="Yes, sent").count() == 0)
    pick(pg, "IT Alpha")
    check("open: coming back only asks again", hero(pg).get_by_text("Did you send").count() == 1)
    pick(pg, "IT Gamma")
    open_channel(c, pg)
    hero(pg).get_by_role("button", name="Yes, sent").click()
    hero(pg).get_by_role("button", name="In 3 days").wait_for(timeout=5000)
    pick(pg, "IT Beta")
    pick(pg, "IT Gamma")
    pg.wait_for_timeout(300)
    check("open: a half-finished yes does not survive leaving", hero(pg).get_by_role("button", name="In 3 days").count() == 0)
    check("open: switching wrote nothing", changed(before) == [], changed(before))
    check("open: history intact", seeded_history_intact())
    c.close()


def s_confirm(p, b, api):
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token)
    pg = c.new_page()
    open_queue(pg)

    # First send, double click on the answer
    before = world()
    pick(pg, "IT Alpha")
    open_channel(c, pg)
    hero(pg).get_by_role("button", name="Yes, sent").dblclick()
    settle(pg)
    a = world()["it-alpha"]
    check("confirm: only Alpha changed", changed(before) == ["it-alpha"], changed(before))
    check("confirm: one message despite a double click", a["msgs"] == 1, a)
    check("confirm: status, first contact and +3 day date", a["status"] == "ENVOYE" and a["sent"] and a["follow"][:10] == day(3), a)
    row = q("select channel, sent_by_id, sent_by_name, body from outreach_messages where prospect_id = 'it-alpha'")[0]
    check("confirm: message names the channel and the person", row[0] == "WHATSAPP" and row[1] == "it-user-owner", row)
    check("confirm: message does not invent text", "body not captured" in row[3], row[3])
    acts = q("select action_type, previous_status, new_status from prospect_activities where prospect_id = 'it-alpha'")
    check("confirm: activity is the send, with the real transition", ("SENT_WHATSAPP", "A_ENVOYER", "ENVOYE") in acts, acts)

    # Instagram on another prospect
    before = world()
    pick(pg, "IT Beta")
    open_channel(c, pg, "Open Instagram")
    hero(pg).get_by_role("button", name="Yes, sent").click()
    settle(pg)
    check("confirm: Instagram goes to the right prospect", changed(before) == ["it-beta"], changed(before))
    check("confirm: Instagram recorded as Instagram", "SENT_INSTAGRAM" in activities("it-beta") and q("select channel from outreach_messages where prospect_id='it-beta'")[0][0] == "INSTAGRAM")

    # Follow-up: 7 days
    before = world()
    pick(pg, "IT Gamma")
    open_channel(c, pg)
    hero(pg).get_by_role("button", name="Yes, sent").click()
    settle(pg, 300)
    check("confirm: nothing saved until the follow-up choice", changed(before) == [], changed(before))
    hero(pg).get_by_role("button", name="In 7 days").click()
    settle(pg)
    g = world()["it-gamma"]
    check("confirm: follow-up changes only Gamma", changed(before) == ["it-gamma"], changed(before))
    check("confirm: follow-up saved with step and +7", g["msgs"] == 2 and g["f1"] and g["follow"][:10] == day(7), g)
    check("confirm: first-contact anchor kept", g["sent"] == before["it-gamma"]["sent"], g)

    # Follow-up: stop
    before = world()
    pick(pg, "IT Iota")
    open_channel(c, pg)
    hero(pg).get_by_role("button", name="Yes, sent").click()
    settle(pg, 300)
    hero(pg).get_by_role("button", name="No more follow-ups").click()
    settle(pg)
    i = world()["it-iota"]
    check("confirm: stop clears the date and logs the decision", i["follow"] is None and "NO_MORE_FOLLOW_UP" in activities("it-iota"), i)
    check("confirm: stop keeps the send", i["msgs"] == 2, i)
    open_queue(pg)
    check("confirm: stopped prospect leaves the queue", "IT Iota" not in pg.locator("main").inner_text())

    # Answering a reply
    before = world()
    pick(pg, "IT Delta")
    open_channel(c, pg)
    hero(pg).get_by_role("button", name="Yes, sent").click()
    settle(pg, 300)
    hero(pg).get_by_role("button", name="In 3 days").click()
    settle(pg)
    d = world()["it-delta"]
    check("confirm: answering keeps Replied", d["status"] == "REPONDU" and d["msgs"] == 2, d)
    check("confirm: the reply flag survives", d["replied"] == 1, d)

    # Possible old reply
    before = world()
    pick(pg, "IT Theta")
    hero(pg).get_by_role("button", name="Not a reply").click()
    settle(pg)
    t = world()["it-theta"]
    check("confirm: Not a reply logs a decision only", t["status"] == before["it-theta"]["status"] and t["acts"] == before["it-theta"]["acts"] + 1 and "REPLY_REVIEWED" in activities("it-theta"), t)
    check("confirm: history intact", seeded_history_intact())
    c.close()


def row(pg, name):
    return pg.locator("table tbody tr", has_text=name)


def click_row(c, pg, name, title):
    with c.expect_page() as popup:
        row(pg, name).get_by_title(title, exact=True).first.click()
    popup.value.close()
    pg.wait_for_timeout(400)


def s_prospects(p, b, api):
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token)
    pg = c.new_page()
    pg.goto(BASE + "/admin/prospecting", wait_until="domcontentloaded", timeout=120000)
    row(pg, "IT Alpha").first.wait_for(timeout=60000)
    settle(pg, 300)
    panel = pg.get_by_role("group", name="Confirm send")
    before = world()

    click_row(c, pg, "IT Alpha", "WhatsApp")
    check("prospects: opening writes nothing", changed(before) == [], changed(before))
    check("prospects: the question names Alpha", "IT Alpha" in panel.inner_text(), panel.inner_text())
    click_row(c, pg, "IT Beta", "WhatsApp")
    check("prospects: switching asks about Beta", "IT Beta" in panel.inner_text() and "IT Alpha" not in panel.inner_text(), panel.inner_text())
    panel.get_by_role("button", name="Yes, sent").click()
    settle(pg)
    check("prospects: only Beta recorded", changed(before) == ["it-beta"], changed(before))
    check("prospects: Alpha untouched", world()["it-alpha"] == before["it-alpha"])

    # Everyone below already has a state a send must not damage.
    for key, keep_status, keep_date in (("delta", "REPONDU", True), ("epsilon", "MEETING", True), ("zeta", "PROPOSAL_SENT", True), ("eta", "ENVOYE", True)):
        name = f"IT {key.capitalize()}"
        before = world()
        title = "WhatsApp" if row(pg, name).get_by_title("WhatsApp", exact=True).count() else "Follow up"
        click_row(c, pg, name, title)
        check(f"prospects: {key}: opening writes nothing", changed(before) == [], changed(before))
        panel.get_by_role("button", name="Yes, sent").click()
        settle(pg, 500)
        if panel.get_by_role("button", name="In 3 days").count():
            panel.get_by_role("button", name="In 3 days").click()
            settle(pg, 500)
        now = world()[f"it-{key}"]
        was = before[f"it-{key}"]
        check(f"prospects: {key}: status kept at {keep_status}", now["status"] == keep_status, now)
        check(f"prospects: {key}: one message added", now["msgs"] == was["msgs"] + 1, now)
        if title == "WhatsApp":
            check(f"prospects: {key}: date not invented or moved", now["follow"] == was["follow"], (was["follow"], now["follow"]))
    check("prospects: history intact", seeded_history_intact())
    c.close()


def s_saturation(p, b, api):
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token)
    pg = c.new_page()
    pg.goto(BASE + "/admin/saturation", wait_until="domcontentloaded", timeout=120000)
    try:
        pg.locator("table tbody tr", has_text="IT Alpha").first.wait_for(timeout=40000)
    except Exception:
        check("saturation: seeded prospect is listed", False, pg.locator("body").inner_text()[:200])
        c.close()
        return
    panel = pg.get_by_role("group", name="Confirm send")
    before = world()
    with c.expect_page() as popup:
        row(pg, "IT Alpha").locator("a[href*='wa.me']").first.click()
    popup.value.close()
    pg.wait_for_timeout(500)
    check("saturation: opening writes nothing", changed(before) == [], changed(before))
    with c.expect_page() as popup:
        row(pg, "IT Beta").locator("a[href*='wa.me']").first.click()
    popup.value.close()
    pg.wait_for_timeout(500)
    check("saturation: switching asks about Beta", "IT Beta" in panel.inner_text(), panel.inner_text())
    panel.get_by_role("button", name="Not sent").click()
    settle(pg, 400)
    check("saturation: Not sent writes nothing", changed(before) == [], changed(before))
    with c.expect_page() as popup:
        row(pg, "IT Beta").locator("a[href*='wa.me']").first.click()
    popup.value.close()
    pg.wait_for_timeout(500)
    panel.get_by_role("button", name="Yes, sent").click()
    settle(pg)
    check("saturation: only Beta recorded", changed(before) == ["it-beta"], changed(before))
    c.close()


def s_failures(p, b, api):
    # 1. The send record fails, then a retry.
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token)
    pg = c.new_page()
    open_queue(pg)
    pick(pg, "IT Alpha")
    before = world()
    fail = {"on": True}
    pg.route("**/api/admin/prospecting/*/outreach", lambda r: r.abort() if fail["on"] else r.fallback())
    open_channel(c, pg)
    hero(pg).get_by_role("button", name="Yes, sent").click()
    settle(pg)
    check("failure: lost connection saves nothing", changed(before) == [], changed(before))
    check("failure: asks to try again, without claiming nothing was saved", "Try again" in hero(pg).inner_text(), hero(pg).inner_text()[:200])
    fail["on"] = False
    hero(pg).get_by_role("button", name="Yes, sent").click()
    settle(pg)
    check("failure: retry records exactly one send", world()["it-alpha"]["msgs"] == 1, world()["it-alpha"])
    c.close()

    # 2. Saved on the server, but the answer never came back. The worst case for a false record.
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token)
    pg = c.new_page()
    open_queue(pg)
    pick(pg, "IT Alpha")

    def lost(route):
        route.fetch()
        route.abort()

    fail = {"on": True}
    pg.route("**/api/admin/prospecting/*/outreach", lambda r: lost(r) if fail["on"] else r.fallback())
    open_channel(c, pg)
    hero(pg).get_by_role("button", name="Yes, sent").click()
    settle(pg)
    text = hero(pg).inner_text()
    check("failure: a lost answer never says nothing was saved", "Nothing was saved" not in text, text[:200])
    fail["on"] = False
    if hero(pg).get_by_role("button", name="Yes, sent").count():
        hero(pg).get_by_role("button", name="Yes, sent").click()
        settle(pg)
    a = world()["it-alpha"]
    check("failure: a lost answer then a retry leaves one send", a["msgs"] == 1, a)
    check("failure: a lost answer then a retry finishes the send", a["status"] == "ENVOYE" and a["follow"] is not None, a)
    check("failure: a retry logs one send activity", activities("it-alpha").count("SENT_WHATSAPP") == 1, activities("it-alpha"))
    c.close()

    # 3. Status and date steps fail after the send is saved.
    for name, match, field in (("status", 1, "status"), ("date", 2, "date")):
        seed()
        _, token = api.login("owner")
        c = browser_ctx(b, token)
        pg = c.new_page()
        open_queue(pg)
        pick(pg, "IT Alpha")
        seen = {"n": 0}

        def failing_at(want):
            def handler(route):
                if route.request.method == "PATCH":
                    seen["n"] += 1
                    if seen["n"] == want:
                        return route.fulfill(status=500, content_type="application/json", body="{}")
                route.fallback()
            return handler

        pg.route("**/api/admin/prospecting/it-alpha", failing_at(match))
        open_channel(c, pg)
        hero(pg).get_by_role("button", name="Yes, sent").click()
        try:
            pg.get_by_text("Send recorded, but").wait_for(timeout=20000)
            told = True
        except Exception as e:
            told = False
            print("   ", repr(e)[:300])
        check(f"failure: {field} step: the failure really happened", seen["n"] >= match, seen)
        check(f"failure: {field} step: told it was recorded", told)
        settle(pg)
        a = world()["it-alpha"]
        check(f"failure: {field} step: the send stays recorded once", a["msgs"] == 1, a)
        check(f"failure: {field} step: the failed save did not apply", (a["status"] == "A_ENVOYER") if field == "status" else (a["status"] == "ENVOYE" and a["follow"] is None), a)
        open_queue(pg)
        items = json.loads(pg.evaluate("fetch('/api/admin/lead-queue').then(r => r.text())"))["items"]
        kinds = [i["kind"] for i in items if i["id"] == "it-alpha"]
        check(f"failure: {field} step: not offered as a first contact again", "ready" not in kinds, kinds)
        c.close()

    # 4. The page is refreshed while the send is on its way.
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token)
    pg = c.new_page()
    open_queue(pg)
    pick(pg, "IT Alpha")

    def slow(route):
        time.sleep(1.2)
        route.fallback()

    pg.route("**/api/admin/prospecting/*/outreach", slow)
    open_channel(c, pg)
    hero(pg).get_by_role("button", name="Yes, sent").click()
    pg.wait_for_timeout(200)
    pg.goto(BASE + "/admin/lead-queue", wait_until="domcontentloaded")
    settle(pg, 2500)
    a = world()["it-alpha"]
    check("failure: refresh mid-send leaves at most one send", a["msgs"] <= 1, a)
    items = json.loads(pg.evaluate("fetch('/api/admin/lead-queue').then(r => r.text())"))["items"]
    kinds = [i["kind"] for i in items if i["id"] == "it-alpha"]
    check("failure: refresh mid-send cannot offer a saved send as new", a["msgs"] == 0 or "ready" not in kinds, (a, kinds))
    c.close()


def s_tabs(p, b, api):
    # Two tabs each answer Yes for the same real message.
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token)
    one, two = c.new_page(), c.new_page()
    open_queue(one)
    open_queue(two)
    pick(one, "IT Alpha")
    pick(two, "IT Alpha")
    open_channel(c, one)
    open_channel(c, two)
    hero(one).get_by_role("button", name="Yes, sent").click()
    settle(one)
    hero(two).get_by_role("button", name="Yes, sent").click()
    settle(two)
    a = world()["it-alpha"]
    check("tabs: one after the other, one send", a["msgs"] == 1, a)
    check("tabs: one after the other, one send activity", activities("it-alpha").count("SENT_WHATSAPP") == 1, activities("it-alpha"))
    c.close()

    # Both at the same moment, straight at the API.
    seed()
    _, token = api.login("owner")
    body = {"channel": "WHATSAPP", "body": "(composed manually in WhatsApp — body not captured)", "templateId": None}
    c = browser_ctx(b, token)
    pages = [c.new_page() for _ in range(5)]
    for page in pages:
        page.goto(BASE + "/admin/login", wait_until="domcontentloaded")
    js = "b => fetch('/api/admin/prospecting/it-alpha/outreach', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b)}).then(r => r.status)"
    for page in pages:
        page.evaluate(f"b => {{ window.__p = ({js})(b); return 1; }}", body)
    statuses = [page.evaluate("window.__p") for page in pages]
    check("tabs: five at once, one send", world()["it-alpha"]["msgs"] == 1, (statuses, world()["it-alpha"]))
    check("tabs: five at once, none fail loudly", all(s < 300 for s in statuses), statuses)
    c.close()

    # A real second follow-up, later, must still be possible.
    seed()
    _, token = api.login("owner")
    r1 = api.call("POST", "/api/admin/prospecting/it-alpha/outreach", token, {"channel": "WHATSAPP", "body": "first"})
    q("update outreach_messages set sent_at = sent_at - interval '10 minutes', created_at = created_at - interval '10 minutes' where prospect_id = 'it-alpha'")
    r2 = api.call("POST", "/api/admin/prospecting/it-alpha/outreach", token, {"channel": "WHATSAPP", "body": "first"})
    check("tabs: a real later send is not swallowed", r1.status == 201 and r2.status == 201 and world()["it-alpha"]["msgs"] == 2, (r1.status, r2.status))
    r3 = api.call("POST", "/api/admin/prospecting/it-beta/outreach", token, {"channel": "WHATSAPP", "body": "a"})
    r4 = api.call("POST", "/api/admin/prospecting/it-beta/outreach", token, {"channel": "INSTAGRAM", "body": "a"})
    check("tabs: another channel is a different send", r3.status == 201 and r4.status == 201 and world()["it-beta"]["msgs"] == 2, (r3.status, r4.status))


def s_race(p, b, api):
    seed()
    _, token = api.login("owner")
    url = "/api/admin/prospecting/it-kappa"
    good = 0
    report = []
    for n in range(6):
        q("update prospects set status = 'ENVOYE' where id = 'it-kappa'")
        calls = [{"status": "ENVOYE", "actionType": "SENT_WHATSAPP"}, {"status": "REPONDU", "actionType": "MARKED_REPLIED"}]
        c = browser_ctx(b, token)
        pg = c.new_page()
        pg.goto(BASE + "/admin/login", wait_until="domcontentloaded")
        pg.evaluate("""([u, calls]) => Promise.all(calls.map((b) => fetch(u, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b)})))""", [url, calls])
        c.close()
        status = world()["it-kappa"]["status"]
        report.append(status)
        good += status == "REPONDU"
    check("race: a reply marked during a send is never lost", good == 6, report)

    # A tab left open: its card was loaded before the reply arrived.
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token)
    pg = c.new_page()
    open_queue(pg)
    pick(pg, "IT Gamma")
    q("update prospects set status = 'REPONDU' where id = 'it-gamma'")
    open_channel(c, pg)
    hero(pg).get_by_role("button", name="Yes, sent").click()
    settle(pg, 300)
    hero(pg).get_by_role("button", name="In 3 days").click()
    settle(pg)
    g = world()["it-gamma"]
    check("race: a stale card cannot undo a reply", g["status"] == "REPONDU", g)
    c.close()

    # A closed prospect stays closed.
    seed()
    _, token = api.login("owner")
    q("update prospects set status = 'LOST' where id = 'it-gamma'")
    r = api.call("PATCH", "/api/admin/prospecting/it-gamma", token, {"status": "ENVOYE", "actionType": "SENT_WHATSAPP"})
    check("race: a stale send cannot reopen a lost prospect", world()["it-gamma"]["status"] == "LOST", r.status)


def s_queue(p, b, api):
    seed()
    _, token = api.login("owner")
    data = api.call("GET", "/api/admin/lead-queue", token).json()
    order = [(i["kind"], i["id"]) for i in data["items"]]
    ids = [i for _, i in order]
    print("  order:", order)
    check("queue: each person once", len(ids) == len(set(ids)), ids)
    check("queue: meeting and proposal stay out", "it-epsilon" not in ids and "it-zeta" not in ids, ids)
    check("queue: a planned future date stays out", "it-eta" not in ids, ids)
    check("queue: confirmed reply is first", order[0] == ("reply", "it-delta"), order[:3])
    kinds = [k for k, _ in order]
    check("queue: a new enquiry comes before a possible old reply", kinds.index("enquiry") < kinds.index("reply_review"), kinds)
    item = next(i for i in data["items"] if i["kind"] == "reply_review")
    check("queue: a possible old reply says so", "Possible old reply, not confirmed" == item["detail"] and "Check if" in item["action"], item)
    check("queue: a possible old reply is not counted as a reply", data["counts"]["replies"] == 1 and data["counts"]["verify"] == 1, data["counts"])
    check("queue: it sits in its own group", item["group"] == "verify", item["group"])

    c = browser_ctx(b, token)
    pg = c.new_page()
    pg.goto(BASE + "/admin", wait_until="domcontentloaded", timeout=120000)
    pg.wait_for_timeout(3500)
    check("queue: Today counts only the confirmed reply", "Replies waiting for you: 4" not in pg.locator("main").inner_text())
    open_queue(pg)
    pick(pg, "IT Theta")
    text = hero(pg).inner_text()
    check("queue: the card labels it for checking", "Possible old reply" in text and "not confirmed" in text, text[:200])
    pg.get_by_role("button", name=re.compile("To verify")).first.click()
    pg.wait_for_timeout(300)
    check("queue: To verify filter shows only it", pg.locator('aside[aria-label="Up next"] li').count() == 0 and "IT Theta" in hero(pg).locator("h2").inner_text())
    check("queue: viewing changes no status", world()["it-theta"]["status"] == "ENVOYE")
    c.close()


def s_phone(p, b, api):
    seed()
    _, token = api.login("owner")
    c = browser_ctx(b, token, 390, 844, mobile=True)
    pg = c.new_page()
    open_queue(pg)
    pick(pg, "IT Alpha") if pg.locator('aside[aria-label="Up next"] button').filter(has_text="IT Alpha").count() else None
    before = world()
    open_channel(c, pg, tap=True)
    settle(pg, 300)
    check("phone: opening writes nothing", changed(before) == [], changed(before))
    wide = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("phone: confirm step fits", wide <= 0, wide)
    hero(pg).get_by_role("button", name="Yes, sent").tap()
    settle(pg)
    check("phone: tap records one send for the right prospect", changed(before) == ["it-alpha"] and world()["it-alpha"]["msgs"] == 1, changed(before))
    c.close()


SCENARIOS = {"auth": s_auth, "open": s_open, "confirm": s_confirm, "prospects": s_prospects, "saturation": s_saturation,
             "failures": s_failures, "tabs": s_tabs, "race": s_race, "queue": s_queue, "phone": s_phone}

chosen = sys.argv[1:] or list(SCENARIOS)
with sync_playwright() as p:
    browser = p.chromium.launch()
    client = Api(p)
    for name in chosen:
        print(f"\n== {name}", flush=True)
        try:
            SCENARIOS[name](p, browser, client)
        except Exception as e:  # keep going: one broken scenario must not hide the others
            check(f"{name}: scenario finished", False, repr(e)[:400])
    browser.close()

print(f"\n{passed} passed, {len(fails)} failed")
for f in fails:
    print("  FAILED:", f)
sys.exit(1 if fails else 0)
