// Batch 2: 15 prospects covering Fès, Agadir + new sectors (bijouterie, caftan, wedding planner, avocat).
// Run: ADMIN_PASSWORD=xxx node scripts/seed-morocco-prospects-batch2.mjs

const BASE = process.env.IBDA3_URL || "https://ibda3-digital.vercel.app";
const EMAIL = process.env.ADMIN_EMAIL || "ayoubkhyat@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!PASSWORD) {
  console.error("❌ Set ADMIN_PASSWORD env var.");
  process.exit(1);
}

const PROSPECTS = [
  // Fès riads
  { name: "Riad Le Moucharabieh Fès", phone: "0772072127", sector: "Riad/Maison d'hôtes", neighborhood: "Médina, Fès" },
  { name: "Riad Rcif Fès", phone: "0662710728", sector: "Riad/Maison d'hôtes", neighborhood: "Médina, Fès" },

  // Agadir restaurants
  { name: "Amsterdam Luxury Restaurant Agadir", phone: "0609070598", instagram: "amsterdamagadir", sector: "Restaurant/Café", neighborhood: "Agadir" },
  { name: "Restaurant LE 20' Agadir", phone: "0661059254", instagram: "restaurantle20", sector: "Restaurant/Café", neighborhood: "Agadir" },
  { name: "Restaurant Les Dinosaures Agadir", phone: "0661691346", instagram: "restaurant_les_dinosaures", sector: "Restaurant/Café", neighborhood: "Anza, Agadir" },

  // Agadir salons
  { name: "Salon Allure Agadir", instagram: "allureagadir", sector: "Salon Beauté", neighborhood: "Agadir", website: "https://salonallure.ma" },
  { name: "Salon HJ Beauty Agadir", phone: "0614730612", instagram: "hj_beauty_agadir", sector: "Salon Beauté", neighborhood: "Hay Mohammadi, Agadir" },

  // Bijouterie
  { name: "Bijouterie Royaume Doré", phone: "0679242701", instagram: "bijouterie_royaume_dore", sector: "Bijouterie", neighborhood: "Maroc (livraison nationale)" },
  { name: "Bijouterie Merveilleuse Casablanca", instagram: "bijouterie.merveilleuse", sector: "Bijouterie", neighborhood: "Al Massira, Casablanca" },

  // Caftan / mode
  { name: "Trois Styles Casablanca", instagram: "troisstylescasablanca", sector: "Boutique Mode", neighborhood: "Ali Abderrazzak, Casablanca" },
  { name: "Mode et Caftan", instagram: "modeetcaftan", sector: "Boutique Mode", neighborhood: "Casablanca" },

  // Wedding planners
  { name: "Mon Mariage Au Maroc", phone: "0675777577", instagram: "monmariageaumaroc", sector: "Wedding Planner", neighborhood: "Maroc" },
  { name: "La Perle Events Marrakech", instagram: "laperlevents_marrakech", sector: "Wedding Planner", neighborhood: "Marrakech" },
  { name: "Diâa Lahmamsi Wedding Planner", instagram: "wedding_planner_diaa_lahmamsi", sector: "Wedding Planner", neighborhood: "Maroc" },

  // Avocat
  { name: "Maître Ouafae Oubbajeddi", phone: "0537580408", sector: "Avocat", neighborhood: "Rabat", website: "https://maitreouafaeoubbajeddi.com" },
];

async function login() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  const m = res.headers.get("set-cookie")?.match(/admin_token=[^;]+/);
  if (!m) throw new Error("admin_token cookie missing");
  return m[0];
}

async function addProspect(cookie, p) {
  const res = await fetch(`${BASE}/api/admin/outreach/quick-add`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(p),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

(async () => {
  console.log(`🔐 Logging in...`);
  const cookie = await login();
  console.log(`✅ Logged in.\n`);

  let created = 0, dupes = 0, errors = 0;
  for (const p of PROSPECTS) {
    const { status, body } = await addProspect(cookie, p);
    if (status === 201) {
      console.log(`✅ [${body.prospect.qualityLabel}] ${p.name} → score ${body.prospect.score}`);
      created++;
    } else if (status === 409) {
      console.log(`⚠️  Duplicate: ${p.name}`);
      dupes++;
    } else {
      console.log(`❌ ${p.name} → ${status}: ${body.error || JSON.stringify(body)}`);
      errors++;
    }
  }

  console.log(`\n🎯 Done: ${created} created · ${dupes} duplicates · ${errors} errors`);
})().catch((err) => { console.error("❌ Fatal:", err.message); process.exit(1); });
