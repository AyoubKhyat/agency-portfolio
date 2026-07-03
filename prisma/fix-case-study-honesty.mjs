/**
 * One-off migration: replace fabricated case-study metrics with verifiable
 * results + honest motion framing, directly in the (Neon) production DB.
 *
 * USAGE (dry run — reads only, prints before/after, writes NOTHING):
 *   DATABASE_URL="postgres://..." DRY_RUN=1 node prisma/fix-case-study-honesty.mjs
 *
 * USAGE (apply — wraps all writes in a single transaction):
 *   DATABASE_URL="postgres://..." node prisma/fix-case-study-honesty.mjs
 *
 * Safe to run repeatedly (idempotent: result columns are set absolutely).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const url = process.env.DATABASE_URL;
if (!url || url.startsWith("file:")) {
  console.error("Refusing to run: DATABASE_URL must be a remote Postgres URL.");
  process.exit(1);
}
const DRY = process.env.DRY_RUN === "1";

// Truthful result slots per slug per locale [en, fr, ar] — mirrors the JSON.
const L = { en: 0, fr: 1, ar: 2 };
const R = {
  "hammam-nour": {
    1: { v: ["Live", "En ligne", "مباشر"], l: ["Shipped & in production", "En production", "تم الإطلاق وقيد التشغيل"] },
    2: { v: ["Motion", "Animation", "حركة"], l: ["Motion-driven UI (Framer Motion)", "Interface animée (Framer Motion)", "واجهة متحركة (Framer Motion)"] },
    3: { v: ["Booking", "Réservation", "حجز"], l: ["Online reservation system", "Système de réservation en ligne", "نظام حجز إلكتروني"] },
  },
  goudoukh: {
    1: { v: ["Live", "En ligne", "مباشر"], l: ["Shipped & in production", "En production", "تم الإطلاق وقيد التشغيل"] },
    2: { v: ["Motion", "Animation", "حركة"], l: ["Motion-driven UI (Framer Motion)", "Interface animée (Framer Motion)", "واجهة متحركة (Framer Motion)"] },
    3: { v: ["EN · FR · AR", "EN · FR · AR", "EN · FR · AR"], l: ["Trilingual interface", "Interface trilingue", "واجهة بثلاث لغات"] },
  },
  tannour: {
    1: { v: ["Live", "En ligne", "مباشر"], l: ["Shipped & in production", "En production", "تم الإطلاق وقيد التشغيل"] },
    2: { v: ["E-commerce", "E-commerce", "تجارة إلكترونية"], l: ["Full product catalog & checkout", "Catalogue complet & paiement", "كتالوج كامل وإتمام الشراء"] },
    3: { v: ["Responsive", "Responsive", "متجاوب"], l: ["Mobile-optimized storefront", "Boutique optimisée mobile", "متجر محسّن للجوال"] },
  },
  terrene: {
    1: { v: ["Live", "En ligne", "مباشر"], l: ["Shipped & in production", "En production", "تم الإطلاق وقيد التشغيل"] },
    2: { v: ["Portfolio", "Portfolio", "معرض أعمال"], l: ["Studio showcase site", "Site vitrine du studio", "موقع عرض الاستوديو"] },
    3: { v: ["Responsive", "Responsive", "متجاوب"], l: ["Mobile-first design", "Conception mobile-first", "تصميم يعتمد الجوال أولاً"] },
  },
  "victory-path": {
    1: { v: ["Live", "En ligne", "مباشر"], l: ["Shipped & in production", "En production", "تم الإطلاق وقيد التشغيل"] },
    2: { v: ["PWA", "PWA", "PWA"], l: ["Installable web app", "Application web installable", "تطبيق ويب قابل للتثبيت"] },
    3: { v: ["EN · AR", "EN · AR", "EN · AR"], l: ["Bilingual interface", "Interface bilingue", "واجهة بلغتين"] },
  },
  "aylani-parfums": {
    1: { v: ["Live", "En ligne", "مباشر"], l: ["Shipped & in production", "En production", "تم الإطلاق وقيد التشغيل"] },
    2: { v: ["E-commerce", "E-commerce", "تجارة إلكترونية"], l: ["WhatsApp-first ordering", "Commande via WhatsApp", "الطلب عبر واتساب"] },
    3: { v: ["Responsive", "Responsive", "متجاوب"], l: ["Mobile-optimized shopping", "Achat optimisé mobile", "تسوق محسّن للجوال"] },
  },
  "luxury-copro": {
    1: { v: ["Live", "En ligne", "مباشر"], l: ["Shipped & in production", "En production", "تم الإطلاق وقيد التشغيل"] },
    2: { v: ["Motion", "Animation", "حركة"], l: ["Motion-driven UI (Framer Motion)", "Interface animée (Framer Motion)", "واجهة متحركة (Framer Motion)"] },
    3: { v: ["FR · EN", "FR · EN", "FR · EN"], l: ["Bilingual interface", "Interface bilingue", "واجهة بلغتين"] },
  },
  "asrar-lalla": {
    1: { v: ["Live", "En ligne", "مباشر"], l: ["Shipped & in production", "En production", "تم الإطلاق وقيد التشغيل"] },
    2: { v: ["E-commerce", "E-commerce", "تجارة إلكترونية"], l: ["Cash-on-delivery & WhatsApp", "Paiement à la livraison & WhatsApp", "الدفع عند الاستلام وواتساب"] },
    3: { v: ["Responsive", "Responsive", "متجاوب"], l: ["Mobile-optimized shopping", "Achat optimisé mobile", "تسوق محسّن للجوال"] },
  },
};

// Solution transforms (honest motion framing + strip embedded fake stats).
// Tolerant: each is applied only if its trigger text is present.
function fixSolution(slug, text) {
  if (!text) return text;
  let out = text;
  // luxury-copro: strip fabricated stats parenthetical (EN/FR/AR variants)
  out = out
    .replace(/,?\s*(impressive statistics|des statistiques impressionnantes|وإحصائيات مبهرة)\s*\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ");
  return out.trim();
}

const adapter = new PrismaNeon({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const projects = await prisma.project.findMany({ include: { translations: true }, orderBy: { sortOrder: "asc" } });
console.log(`Projects in DB: ${projects.map((p) => p.slug).join(", ")}\n`);

const ops = [];
for (const p of projects) {
  const slugR = R[p.slug];
  if (!slugR) { console.log(`(skip ${p.slug}: not in honesty map)`); continue; }
  for (const tr of p.translations) {
    const idx = L[tr.locale];
    if (idx === undefined) continue;
    const data = {};
    for (const n of [1, 2, 3]) {
      data[`result${n}Value`] = slugR[n].v[idx];
      data[`result${n}Label`] = slugR[n].l[idx];
    }
    const newSolution = fixSolution(p.slug, tr.solution);
    if (newSolution !== tr.solution) data.solution = newSolution;

    // Show before/after
    console.log(`■ ${p.slug} [${tr.locale}]`);
    for (const n of [1, 2, 3]) {
      console.log(`    result${n}: "${tr["result" + n + "Value"]}" / "${tr["result" + n + "Label"]}"  ->  "${data["result" + n + "Value"]}" / "${data["result" + n + "Label"]}"`);
    }
    if (data.solution) console.log(`    solution: stripped fake stats (${tr.solution.length} -> ${data.solution.length} chars)`);

    ops.push(prisma.projectTranslation.update({ where: { id: tr.id }, data }));
  }
}

console.log(`\n${ops.length} translation rows to update.`);
if (DRY) {
  console.log("DRY_RUN=1 -> no writes performed.");
} else {
  await prisma.$transaction(ops);
  console.log("✅ Applied in a single transaction.");
}
await prisma.$disconnect();
