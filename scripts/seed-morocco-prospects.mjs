// One-shot importer for the 10 hand-researched Moroccan prospects.
// Run: node scripts/seed-morocco-prospects.mjs
// Set ADMIN_EMAIL and ADMIN_PASSWORD env vars, or pass via command line.

const BASE = process.env.IBDA3_URL || "https://ibda3-digital.vercel.app";
const EMAIL = process.env.ADMIN_EMAIL || "ayoubkhyat@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!PASSWORD) {
  console.error("❌ Set ADMIN_PASSWORD env var. Example:");
  console.error("   ADMIN_PASSWORD=xxx node scripts/seed-morocco-prospects.mjs");
  process.exit(1);
}

const PROSPECTS = [
  { name: "Riad Marrakech Doors", phone: "0524378637", instagram: "riad_marrakechdoors", sector: "Riad/Maison d'hôtes", neighborhood: "Marrakech Medina" },
  { name: "Riad Livia Marrakech", phone: "0636498546", instagram: "riadliviamarrakech", sector: "Riad/Maison d'hôtes", neighborhood: "Marrakech Medina", website: "https://www.riad-livia.com" },
  { name: "Salon Redouane Casablanca", phone: "0653910392", instagram: "salonredouane_casablanca", sector: "Salon Beauté", neighborhood: "Bourgogne, Casablanca" },
  { name: "The Trendy Lounge Casablanca", phone: "0770581414", instagram: "lounge.trendy", sector: "Salon Beauté", neighborhood: "Anfa, Casablanca" },
  { name: "Café Restaurant Equestre Tanger", phone: "0808673973", instagram: "caferestaurant_equestretanger", sector: "Restaurant/Café", neighborhood: "Tanger" },
  { name: "Sky17 Café Restaurant Tanger", phone: "0539323100", instagram: "cafesky17", sector: "Restaurant/Café", neighborhood: "Tanger" },
  { name: "Centre Dentaire Lahyani", instagram: "dr_lahyani_dentiste", sector: "Dentiste", neighborhood: "Hassan, Rabat" },
  { name: "Pâtisserie Casabianca", instagram: "patisserie.casabianca", sector: "Patisserie", neighborhood: "Hay Al Qods, Casablanca" },
  { name: "Marrakech Spa Hammam & Massage", phone: "0707716161", instagram: "marrakech.massage", sector: "Spa/Hammam", neighborhood: "Marrakech" },
  { name: "Anber Tanger Moroccan Restaurant", instagram: "anber_tanger", sector: "Restaurant/Café", neighborhood: "Malabata, Tanger", website: "https://anbertanger.com" },
];

async function login() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("No set-cookie header returned by login");
  // Extract admin_token=...; from the Set-Cookie header
  const match = setCookie.match(/admin_token=[^;]+/);
  if (!match) throw new Error("admin_token cookie not found in: " + setCookie);
  return match[0];
}

async function addProspect(cookie, p) {
  const res = await fetch(`${BASE}/api/admin/outreach/quick-add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(p),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

(async () => {
  console.log(`🔐 Logging in to ${BASE} as ${EMAIL}...`);
  const cookie = await login();
  console.log("✅ Logged in.\n");

  let created = 0, dupes = 0, errors = 0;
  for (const p of PROSPECTS) {
    const { status, body } = await addProspect(cookie, p);
    if (status === 201) {
      console.log(`✅ [${body.prospect.qualityLabel}] ${p.name} → score ${body.prospect.score}`);
      created++;
    } else if (status === 409) {
      console.log(`⚠️  Duplicate: ${p.name} (already in DB as "${body.duplicate?.name}")`);
      dupes++;
    } else {
      console.log(`❌ ${p.name} → ${status}: ${body.error || JSON.stringify(body)}`);
      errors++;
    }
  }

  console.log(`\n🎯 Done: ${created} created · ${dupes} duplicates · ${errors} errors`);
  console.log(`   → https://ibda3-digital.vercel.app/admin/prospecting?status=A_ENVOYER`);
})().catch((err) => {
  console.error("❌ Fatal:", err.message);
  process.exit(1);
});
