// Batch 3: 23 prospects covering Meknès, Kénitra, Oujda + new sectors (salle de sport, opticien, traiteur, photographe, spa).
// Run: ADMIN_PASSWORD=xxx node scripts/seed-morocco-prospects-batch3.mjs

const BASE = process.env.IBDA3_URL || "https://ibda3-digital.vercel.app";
const EMAIL = process.env.ADMIN_EMAIL || "ayoubkhyat@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!PASSWORD) { console.error("❌ Set ADMIN_PASSWORD env var."); process.exit(1); }

const PROSPECTS = [
  // Meknès restaurants
  { name: "Restaurant Belle-Vue Meknès", phone: "0661051045", sector: "Restaurant/Café", neighborhood: "Meknès", website: "https://restaurantbellevue.ma" },
  { name: "Palais Ismailia Meknès", phone: "0656259595", sector: "Restaurant/Café", neighborhood: "Médina, Meknès" },

  // Kénitra beauty salons
  { name: "Centre Beauty Queen Kénitra", instagram: "centre.beauty.queen.kenitra", sector: "Salon Beauté", neighborhood: "Mohamed V, Kénitra" },
  { name: "Alija Beauty Center Kénitra", instagram: "alijabeautycenter", sector: "Salon Beauté", neighborhood: "Imam Ali, Kénitra" },
  { name: "VIP Beauty Center Kénitra", instagram: "vip_beauty_center_kenitra", sector: "Salon Beauté", neighborhood: "Kénitra" },
  { name: "Cleopatra Centre de Beauté Kénitra", instagram: "cleopatra_kenitra", sector: "Salon Beauté", neighborhood: "Kénitra" },

  // Oujda restaurants
  { name: "Oxford Coffee Oujda", phone: "0677664326", instagram: "oxfordcoffeeoujda", sector: "Restaurant/Café", neighborhood: "Hay Al Qods, Oujda" },
  { name: "Bab El Gharbi Restaurant Oujda", phone: "0639135374", instagram: "babelgharbi.oujda", sector: "Restaurant/Café", neighborhood: "Bab el Gharbi, Oujda", website: "https://babelgharbi.ma" },
  { name: "Restaurant El Gusto Oujda", phone: "0680698201", sector: "Restaurant/Café", neighborhood: "Oujda" },

  // Salles de sport Casablanca
  { name: "ON AIR FITNESS Casablanca", phone: "0520873897", sector: "Salle de Sport", neighborhood: "Casablanca", website: "https://www.onair-fitness.ma" },
  { name: "Club Moving Casablanca", phone: "0522862050", sector: "Salle de Sport", neighborhood: "Allée du Cygne, Casablanca" },

  // Opticiens
  { name: "Optiraffiné Kénitra", phone: "0645669192", instagram: "Optiraffine", sector: "Opticien", neighborhood: "Mimousa, Kénitra", website: "https://optiraffine.ma" },
  { name: "Lynx Optique Maroc", phone: "0672175122", instagram: "lynxoptique", sector: "Opticien", neighborhood: "Maroc" },

  // Traiteurs
  { name: "Les Maîtres Prestiges Marrakech", phone: "0668474798", instagram: "lesmaitresprestiges", sector: "Traiteur", neighborhood: "Marrakech" },
  { name: "Maison Sama Marrakech (Traiteur)", phone: "0661694847", instagram: "maisonsama.traiteur", sector: "Traiteur", neighborhood: "Marrakech" },
  { name: "L'Atelier M Casablanca (Traiteur)", phone: "0661893666", instagram: "latelierm_maroc", sector: "Traiteur", neighborhood: "Casablanca" },
  { name: "Traiteur Oriental Roudania", instagram: "traiteurroudania", sector: "Traiteur", neighborhood: "Maroc" },
  { name: "Samraa Traiteur", phone: "0666034373", instagram: "traiteursamraa", sector: "Traiteur", neighborhood: "Maroc" },

  // Photographes mariage
  { name: "Mebrouk Yassmine Photographe", phone: "0654320070", instagram: "mebroukyassmine", sector: "Photographe/Vidéaste", neighborhood: "Rabat-Salé", website: "https://www.mebroukyassmine.com" },
  { name: "RMStudio Photographe", phone: "0605707440", sector: "Photographe/Vidéaste", neighborhood: "Salé", website: "https://www.rmstudio.ma" },
  { name: "Ma Photographe Wedding", phone: "0602881668", instagram: "maphotographe.wedding", sector: "Photographe/Vidéaste", neighborhood: "Maroc", website: "https://be-maphotographe.com" },

  // Spas Marrakech (additional)
  { name: "Hammam Rosa Bonheur Marrakech", phone: "0666585233", sector: "Spa/Hammam", neighborhood: "Marrakech", website: "https://www.hammamrosabonheur.com" },
  { name: "Jad Jasmine Spa Marrakech", phone: "0638989507", sector: "Spa/Hammam", neighborhood: "Sakka, Marrakech" },
];

async function login() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  const m = res.headers.get("set-cookie")?.match(/admin_token=[^;]+/);
  if (!m) throw new Error("admin_token cookie missing");
  return m[0];
}

async function addProspect(cookie, p) {
  const res = await fetch(`${BASE}/api/admin/outreach/quick-add`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(p),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

(async () => {
  console.log(`🔐 Logging in...`);
  const cookie = await login();
  console.log(`✅ Logged in.\n`);
  let created = 0, dupes = 0, errors = 0;
  for (const p of PROSPECTS) {
    const { status, body } = await addProspect(cookie, p);
    if (status === 201) { console.log(`✅ [${body.prospect.qualityLabel}] ${p.name} → score ${body.prospect.score}`); created++; }
    else if (status === 409) { console.log(`⚠️  Duplicate: ${p.name}`); dupes++; }
    else { console.log(`❌ ${p.name} → ${status}: ${body.error || JSON.stringify(body)}`); errors++; }
  }
  console.log(`\n🎯 Done: ${created} created · ${dupes} duplicates · ${errors} errors`);
})().catch((err) => { console.error("❌ Fatal:", err.message); process.exit(1); });
