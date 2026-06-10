import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import {
  getDiscoveryProvider,
  CITIES,
  SECTORS,
  OverpassError,
  type DiscoveryCandidate,
} from "@/lib/discovery-providers";
import { classify, type DuplicateStatus } from "@/lib/discovery-duplicates";

const bodySchema = z.object({
  city: z.string().min(1),
  sector: z.string().min(1),
  neighborhood: z.string().nullable().optional(),
  keyword: z.string().nullable().optional(),
});

export type SearchResultItem = DiscoveryCandidate & {
  duplicateStatus: DuplicateStatus;
  duplicateOf: string | null;
  duplicateReason: string | null;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  // Validate sector + city
  if (!CITIES.find((c) => c.key === parsed.data.city)) {
    return NextResponse.json({ error: "Unsupported city" }, { status: 400 });
  }
  if (!SECTORS.find((s) => s.key === parsed.data.sector)) {
    return NextResponse.json({ error: "Unsupported sector" }, { status: 400 });
  }

  const provider = getDiscoveryProvider();

  let candidates: DiscoveryCandidate[];
  try {
    candidates = await provider.search({
      city: parsed.data.city,
      sector: parsed.data.sector,
      neighborhood: parsed.data.neighborhood ?? null,
      keyword: parsed.data.keyword ?? null,
    });
  } catch (err) {
    if (err instanceof OverpassError) {
      return NextResponse.json(
        { error: err.code, provider: provider.name, message: err.message, endpoint: err.endpoint },
        { status: err.code === "OSM_RATE_LIMITED" ? 429 : 502 }
      );
    }
    return NextResponse.json(
      { error: "SEARCH_FAILED", provider: provider.name, message: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  // Pull existing prospects scoped to this sector (broader than the search to catch cross-sector dups)
  const existing = await prisma.prospect.findMany({
    select: { id: true, name: true, phone: true, instagram: true, whatsappLink: true, neighborhood: true, sector: true },
  });

  const items: SearchResultItem[] = candidates.map((c) => {
    const { status, matchedId, reason } = classify(c, existing);
    return { ...c, duplicateStatus: status, duplicateOf: matchedId, duplicateReason: reason };
  });

  return NextResponse.json({
    provider: provider.name,
    total: items.length,
    counts: {
      new: items.filter((i) => i.duplicateStatus === "NEW").length,
      possible: items.filter((i) => i.duplicateStatus === "POSSIBLE").length,
      exists: items.filter((i) => i.duplicateStatus === "EXISTS").length,
    },
    items,
  });
}
