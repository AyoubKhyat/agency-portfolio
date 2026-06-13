import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { computeQualityLabel } from "@/lib/prospect-quality";

/**
 * Data-consistency audit for prospects.
 * Diagnoses every category the user listed, plus a few we noticed:
 *  - HOT without any contact (should be empty)
 *  - Stored qualityLabel doesn't match what computeQualityLabel returns
 *  - phone present but whatsappLink missing
 *  - Instagram handle exists but malformed
 *  - prospects missing both name and phone (broken imports)
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const prospects = await prisma.prospect.findMany({
    select: {
      id: true, name: true, phone: true, whatsappLink: true,
      instagram: true, website: true, email: true,
      qualityLabel: true, score: true, scoreLabel: true, status: true,
      createdAt: true, source: true,
    },
  });

  const totals = {
    total: prospects.length,
    HOT: prospects.filter((p) => p.qualityLabel === "HOT").length,
    WARM: prospects.filter((p) => p.qualityLabel === "WARM").length,
    COLD: prospects.filter((p) => p.qualityLabel === "COLD").length,
    nullLabel: prospects.filter((p) => !p.qualityLabel).length,
  };

  // 1. HOT prospects with no usable contact (should be 0)
  const hotNoContact = prospects.filter((p) =>
    p.qualityLabel === "HOT" &&
    !(p.phone && p.phone.trim()) &&
    !(p.whatsappLink && p.whatsappLink.trim()) &&
    !(p.instagram && p.instagram.trim())
  );

  // 2. Phone present but whatsappLink missing (data hygiene, can autofix)
  const phoneNoWhatsapp = prospects.filter((p) =>
    p.phone && p.phone.trim() &&
    (!p.whatsappLink || !p.whatsappLink.trim())
  );

  // 3. Instagram present but missing the IG button rendering would imply
  //    bad handle format — empty or just whitespace.
  const igMalformed = prospects.filter((p) =>
    p.instagram && p.instagram.trim() && !/^@?[\w.]+$/.test(p.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, ""))
  );

  // 4. Stored qualityLabel doesn't match what the function would return now (stale backfill)
  const mismatched = prospects.filter((p) => {
    const recomputed = computeQualityLabel({
      phone: p.phone, whatsapp: p.whatsappLink, instagram: p.instagram, website: p.website, email: p.email,
    });
    return p.qualityLabel !== recomputed;
  }).map((p) => ({
    id: p.id, name: p.name, stored: p.qualityLabel,
    recomputed: computeQualityLabel({
      phone: p.phone, whatsapp: p.whatsappLink, instagram: p.instagram, website: p.website, email: p.email,
    }),
  }));

  // 5. Missing name (broken import)
  const missingName = prospects.filter((p) => !p.name || !p.name.trim());

  // 6. Prospects with neither phone nor IG (truly uncontactable — should be COLD)
  const noContact = prospects.filter((p) =>
    !(p.phone && p.phone.trim()) &&
    !(p.whatsappLink && p.whatsappLink.trim()) &&
    !(p.instagram && p.instagram.trim())
  );

  // 7. HOT-via-Instagram only (no phone) — verify IG handle is renderable
  const hotIgOnly = prospects.filter((p) =>
    p.qualityLabel === "HOT" &&
    !(p.phone && p.phone.trim()) &&
    p.instagram && p.instagram.trim()
  );

  // 8. HOT-via-phone (no IG) — verify phone is renderable
  const hotPhoneOnly = prospects.filter((p) =>
    p.qualityLabel === "HOT" &&
    !(p.instagram && p.instagram.trim()) &&
    p.phone && p.phone.trim()
  );

  // Sample 20 random HOT prospects for the diagnostic table
  const hot = prospects.filter((p) => p.qualityLabel === "HOT");
  const sample = [...hot].sort(() => Math.random() - 0.5).slice(0, 20).map((p) => ({
    id: p.id, name: p.name, phone: p.phone || null, whatsapp: p.whatsappLink || null,
    instagram: p.instagram || null, website: p.website || null,
    qualityLabel: p.qualityLabel, score: p.score,
  }));

  return NextResponse.json({
    totals,
    issues: {
      hotNoContact: { count: hotNoContact.length, sample: hotNoContact.slice(0, 50).map(slim) },
      phoneNoWhatsapp: { count: phoneNoWhatsapp.length, sample: phoneNoWhatsapp.slice(0, 50).map(slim) },
      igMalformed: { count: igMalformed.length, sample: igMalformed.slice(0, 50).map(slim) },
      qualityMismatch: { count: mismatched.length, sample: mismatched.slice(0, 50) },
      missingName: { count: missingName.length, sample: missingName.slice(0, 50).map(slim) },
      noContact: { count: noContact.length, sample: noContact.slice(0, 50).map(slim) },
    },
    breakdown: {
      hotIgOnly: hotIgOnly.length,
      hotPhoneOnly: hotPhoneOnly.length,
      hotBoth: hot.length - hotIgOnly.length - hotPhoneOnly.length,
    },
    sample,
  });
}

function slim(p: { id: string; name: string; phone: string; whatsappLink: string; instagram: string; qualityLabel: string | null; status: string }) {
  return {
    id: p.id, name: p.name, phone: p.phone || null, whatsapp: p.whatsappLink || null,
    instagram: p.instagram || null, qualityLabel: p.qualityLabel, status: p.status,
  };
}

// POST → run fixes
const FIX_ACTIONS = ["FIX_WHATSAPP_LINKS", "REFRESH_QUALITY_LABELS"] as const;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as (typeof FIX_ACTIONS)[number] | undefined;
  if (!action || !FIX_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (action === "FIX_WHATSAPP_LINKS") {
    // Rebuild wa.me link for any prospect with phone but empty whatsappLink
    const targets = await prisma.prospect.findMany({
      where: { whatsappLink: "", phone: { not: "" } },
      select: { id: true, phone: true },
    });
    let updated = 0;
    for (const t of targets) {
      const digits = t.phone.replace(/\D/g, "");
      if (!digits) continue;
      await prisma.prospect.update({
        where: { id: t.id },
        data: { whatsappLink: `https://wa.me/${digits.length === 9 || digits.length === 10 ? "212" + digits.replace(/^0/, "") : digits}` },
      });
      updated++;
    }
    return NextResponse.json({ action, updated, examined: targets.length });
  }

  if (action === "REFRESH_QUALITY_LABELS") {
    const all = await prisma.prospect.findMany({
      select: { id: true, phone: true, whatsappLink: true, instagram: true, website: true, email: true, qualityLabel: true },
    });
    let updated = 0;
    for (const p of all) {
      const recomputed = computeQualityLabel({
        phone: p.phone, whatsapp: p.whatsappLink, instagram: p.instagram, website: p.website, email: p.email,
      });
      if (recomputed !== p.qualityLabel) {
        await prisma.prospect.update({ where: { id: p.id }, data: { qualityLabel: recomputed } });
        updated++;
      }
    }
    return NextResponse.json({ action, updated, examined: all.length });
  }

  return NextResponse.json({ error: "No-op" });
}
