/**
 * Existing-prospect contact verification pass.
 *
 * Cleans the CRM of dead / fabricated contact data, honesty-first. It NEVER
 * invents anything — it only downgrades or clears what can't be verified.
 *
 * What it checks per prospect (offline, no scraping, no paid APIs):
 *   - Website  → HTTP reachability. Dead → clear website + hasWebsite=false.
 *   - Phone    → E.164 normalize. Malformed → flagged (cleared on apply).
 *   - WhatsApp → detect links AUTO-DERIVED from the phone (wa.me/<phone>) and
 *                remove them; whatsappStatus stays UNVERIFIED (button hidden).
 *   - Instagram→ format check only (existence can't be verified without
 *                scraping). Format-broken handles are cleared; the rest stay
 *                UNVERIFIED (hidden until a human confirms in the drawer).
 *
 * USAGE — DRY RUN (reads only, writes NOTHING, prints the report):
 *   DATABASE_URL="postgres://..." node prisma/verify-existing-prospects.mjs
 *
 * USAGE — APPLY (only after you approve the report; single transaction):
 *   DATABASE_URL="postgres://..." APPLY=1 node prisma/verify-existing-prospects.mjs
 *
 * Idempotent and safe to run repeatedly.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { promises as dns } from "node:dns";

const url = process.env.DATABASE_URL;
if (!url || url.startsWith("file:")) {
  console.error("Refusing to run: DATABASE_URL must be a remote Postgres URL.");
  process.exit(1);
}
const APPLY = process.env.APPLY === "1";
const WEBSITE_TIMEOUT_MS = 5000;
const CONCURRENCY = 8;

/* ─────────────────── format helpers (self-contained) ─────────────────── */

// IG handle: 1–30 chars, letters/numbers/dots/underscores, no edge/adjacent dots.
const IG_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/i;

function repairInstagramHandle(raw) {
  let v = (raw || "").trim();
  if (!v) return { handle: "", valid: false, hadValue: false };
  v = v.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "");
  v = v.replace(/[/?#].*$/, "");
  v = v.replace(/^@/, "");
  return { handle: v.toLowerCase(), valid: IG_RE.test(v), hadValue: true };
}

// Normalize a phone to digits in international form; valid = 8–15 digits.
function normalizePhoneDigits(raw) {
  if (!raw) return { digits: "", valid: false, hadValue: false };
  let d = raw.replace(/[^\d+]/g, "");
  if (!d) return { digits: "", valid: false, hadValue: true };
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (d.startsWith("0")) d = "+212" + d.slice(1);       // Moroccan national → intl
  if (!d.startsWith("+")) d = d.length >= 10 ? "+" + d : "+212" + d;
  const digits = d.slice(1);
  return { digits, valid: /^\d{8,15}$/.test(digits), hadValue: true };
}

function isPrivateHost(host) {
  const h = host.toLowerCase();
  return (
    h === "localhost" || h.endsWith(".local") || /^127\./.test(h) ||
    /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) ||
    h === "::1" || h === "0.0.0.0"
  );
}

/** "REACHABLE" | "DEAD" | "INCONCLUSIVE" — never throws. */
async function checkWebsite(rawUrl) {
  const v = (rawUrl || "").trim();
  if (!v) return "INCONCLUSIVE";
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  let host = "";
  try { host = new URL(withScheme).hostname; } catch { return "DEAD"; }
  if (isPrivateHost(host)) return "DEAD";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBSITE_TIMEOUT_MS);
  try {
    try {
      await fetch(withScheme, { method: "HEAD", redirect: "follow", signal: controller.signal });
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      await fetch(withScheme, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    return "REACHABLE"; // any HTTP response = the domain serves
  } catch (e) {
    if (e?.name === "AbortError") return "INCONCLUSIVE"; // timeout → don't clear
    // DNS failure = definitively dead; other network errors = inconclusive.
    const code = e?.cause?.code || e?.code;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DEAD";
    return "DEAD";
  } finally {
    clearTimeout(timer);
  }
}

/** Run an async mapper over items with a fixed concurrency. */
async function mapPool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  return results;
}

/* ─────────────────────────── main ─────────────────────────── */

const adapter = new PrismaNeon({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const prospects = await prisma.prospect.findMany({
  select: { id: true, name: true, phone: true, whatsappLink: true, instagram: true, website: true, hasWebsite: true },
  orderBy: { createdAt: "asc" },
});

console.log(`\nChecking ${prospects.length} prospects (${APPLY ? "APPLY" : "DRY RUN"})…\n`);

const plans = await mapPool(prospects, async (p) => {
  const update = {};
  const flags = [];

  // Website
  const websiteStatus = await checkWebsite(p.website);
  if (p.website && websiteStatus === "DEAD") {
    update.website = "";
    update.hasWebsite = false;
    flags.push("DEAD_WEBSITE");
  }

  // Phone
  const phone = normalizePhoneDigits(p.phone);
  if (phone.hadValue && !phone.valid) {
    update.phone = "";
    flags.push("MALFORMED_PHONE");
  }

  // WhatsApp — remove links auto-derived from the phone.
  const linkDigits = (p.whatsappLink || "").replace(/\D/g, "");
  if (linkDigits) {
    const derived = phone.valid && linkDigits === phone.digits;
    if (derived) {
      update.whatsappLink = "";
      update.whatsappStatus = "UNVERIFIED";
      flags.push("AUTO_DERIVED_WHATSAPP");
    }
  }

  // Instagram — clear only format-broken handles (existence unverifiable here).
  const ig = repairInstagramHandle(p.instagram);
  if (ig.hadValue && !ig.valid) {
    update.instagram = "";
    flags.push("BROKEN_INSTAGRAM");
  }

  return { p, update, flags, websiteStatus };
});

/* ─────────────────────────── report ─────────────────────────── */

const deadWebsites = plans.filter((x) => x.flags.includes("DEAD_WEBSITE"));
const brokenInstagram = plans.filter((x) => x.flags.includes("BROKEN_INSTAGRAM"));
const malformedPhones = plans.filter((x) => x.flags.includes("MALFORMED_PHONE"));
const autoWhatsapp = plans.filter((x) => x.flags.includes("AUTO_DERIVED_WHATSAPP"));
const toUpdate = plans.filter((x) => Object.keys(x.update).length > 0);
const inconclusiveWebsites = plans.filter((x) => x.p.website && x.websiteStatus === "INCONCLUSIVE");

function sample(list, pick) {
  return list.slice(0, 8).map((x) => `      - ${x.p.name}: ${pick(x)}`).join("\n");
}

console.log("═══════════════════ VERIFICATION REPORT ═══════════════════");
console.log(`  Total prospects checked ............ ${prospects.length}`);
console.log(`  Dead websites found ................ ${deadWebsites.length}`);
console.log(`  Broken Instagram links found ....... ${brokenInstagram.length}`);
console.log(`  Malformed phones found ............. ${malformedPhones.length}`);
console.log(`  Auto-derived WhatsApp to remove .... ${autoWhatsapp.length}`);
console.log(`  ── Prospects that would be updated .. ${toUpdate.length}`);
console.log(`  (websites inconclusive/timeout, left as-is: ${inconclusiveWebsites.length})`);
console.log("════════════════════════════════════════════════════════════\n");

if (deadWebsites.length) console.log(`  Dead websites (sample):\n${sample(deadWebsites, (x) => x.p.website)}\n`);
if (brokenInstagram.length) console.log(`  Broken Instagram (sample):\n${sample(brokenInstagram, (x) => x.p.instagram)}\n`);
if (malformedPhones.length) console.log(`  Malformed phones (sample):\n${sample(malformedPhones, (x) => x.p.phone)}\n`);
if (autoWhatsapp.length) console.log(`  Auto-derived WhatsApp (sample):\n${sample(autoWhatsapp, (x) => x.p.whatsappLink)}\n`);

if (!APPLY) {
  console.log("DRY RUN — no changes written. Re-run with APPLY=1 after approval.\n");
  await prisma.$disconnect();
  process.exit(0);
}

// APPLY — one transaction.
const ops = toUpdate.map((x) => prisma.prospect.update({ where: { id: x.p.id }, data: x.update }));
await prisma.$transaction(ops);
console.log(`✅ Applied ${ops.length} prospect updates in a single transaction.\n`);
await prisma.$disconnect();
