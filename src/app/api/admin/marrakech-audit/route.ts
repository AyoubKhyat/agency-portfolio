import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { isMobileMA, isFixedLineMA } from "@/lib/prospect-quality";

/**
 * Marrakech Actionable Audit — raw counts from the database, nothing estimated.
 *
 * Unlock rule:
 *   actionable_remaining < 100 → unlock expansion
 *   actionable_remaining >= 100 → stay in Marrakech
 */
const UNLOCK_THRESHOLD = 100;

const MARRAKECH_NEIGHBORHOODS = new Set([
  "Gueliz", "Hivernage", "Medina", "Sidi Ghanem", "Targa", "Mhamid",
  "Hay Hassani", "Daoudiate", "Route de Casablanca", "Route de Safi",
  "Route d'Ourika", "Route de Fès", "Semlalia", "Majorelle", "Agdal",
  "Palmeraie", "Izdihar", "Azli", "Hay Charaf", "Amerchich",
  "Massira", "Ennakhil", "Bab Doukkala", "Marrakech",
].map((s) => s.toLowerCase()));

function isMarrakech(neighborhood: string | null | undefined): boolean {
  if (!neighborhood) return true;
  const lower = neighborhood.toLowerCase();
  if (MARRAKECH_NEIGHBORHOODS.has(lower)) return true;
  for (const n of MARRAKECH_NEIGHBORHOODS) if (lower.includes(n)) return true;
  return false;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const all = await prisma.prospect.findMany({
    select: {
      id: true, name: true, sector: true, neighborhood: true,
      phone: true, whatsappLink: true, instagram: true, website: true, email: true,
      qualityLabel: true, score: true, status: true,
      sentAt: true, lastActionAt: true,
      source: true,
      owner: { select: { id: true, fullName: true } },
      _count: { select: { outreachMessages: { where: { replied: true } } } },
    },
  });

  const marrakech = all.filter((p) => isMarrakech(p.neighborhood));

  // Per-prospect contact classification (raw)
  const counts = {
    totalMarrakech: marrakech.length,
    withMobile: 0,
    withInstagram: 0,
    withBothMobileAndInstagram: 0,
    withLandlineOnly: 0,
    withNoContact: 0,
  };

  for (const p of marrakech) {
    const mobile = isMobileMA(p.phone) || isMobileMA(p.whatsappLink);
    const ig = !!(p.instagram && p.instagram.trim());
    const fixed = isFixedLineMA(p.phone) && !mobile;
    const hasAnyContact = mobile || ig || fixed || !!(p.website && p.website.trim()) || !!(p.email && p.email.trim());

    if (mobile) counts.withMobile++;
    if (ig) counts.withInstagram++;
    if (mobile && ig) counts.withBothMobileAndInstagram++;
    if (fixed && !ig) counts.withLandlineOnly++;
    if (!hasAnyContact) counts.withNoContact++;
  }

  // HOT funnel — straight counts
  const hot = marrakech.filter((p) => p.qualityLabel === "HOT");
  const hotFunnel = {
    notContacted: hot.filter((p) => !p.sentAt).length,
    contacted: hot.filter((p) => !!p.sentAt).length,
    replied: hot.filter((p) => p._count.outreachMessages > 0 || p.status === "REPONDU").length,
    converted: hot.filter((p) => p.status === "CONVERTI" || p.status === "CLIENT").length,
  };

  // The actionable remaining list
  const actionable = marrakech
    .filter((p) => {
      const mobile = isMobileMA(p.phone) || isMobileMA(p.whatsappLink);
      const ig = !!(p.instagram && p.instagram.trim());
      return (mobile || ig) && !p.sentAt;
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      sector: p.sector,
      mobile: isMobileMA(p.phone) ? p.phone : null,
      instagram: p.instagram?.trim() ? p.instagram.replace(/^@/, "") : null,
      lastActivity: p.lastActionAt?.toISOString() ?? null,
      source: p.source || "MANUAL",
      score: p.score,
      qualityLabel: p.qualityLabel,
      owner: p.owner,
      neighborhood: p.neighborhood,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const actionableRemaining = actionable.length;
  const unlockExpansion = actionableRemaining < UNLOCK_THRESHOLD;

  return NextResponse.json({
    config: { unlockThreshold: UNLOCK_THRESHOLD },
    counts,
    hotFunnel,
    actionable,
    actionableRemaining,
    unlockExpansion,
    recommendation: unlockExpansion
      ? `Only ${actionableRemaining} actionable prospects left — below ${UNLOCK_THRESHOLD}. Expansion unlocked.`
      : `${actionableRemaining} actionable prospects remaining. Stay in Marrakech.`,
  });
}
