import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerOrAdmin } from "@/lib/authz";
import { createRateLimiter } from "@/lib/rate-limit";
import { SITE_URL_MAX } from "@/lib/diagnosis";
import { AUDIT_CHUNK, UnknownSectorError, auditChunk, searchBatch } from "@/lib/batch-discovery";
import { DatasetMissingError, loadDataset } from "@/lib/osm-dataset";

/** Each step is short: one read of the local list plus the CRM, or at most AUDIT_CHUNK site checks side by side. */
export const maxDuration = 60;

/** Each search reads the CRM; a few a minute is plenty, for one user and for the whole app. */
const searchPerUser = createRateLimiter({ max: 6, windowMs: 60_000 });
const searchGlobal = createRateLimiter({ max: 12, windowMs: 60_000 });
/** Ten sites take four audit steps; allow a retry or two. */
const auditPerUser = createRateLimiter({ max: 8, windowMs: 60_000 });

const short = (max: number) => z.string().max(max).nullable();
const candidate = z.object({
  sourceId: z.string().regex(/^(node|way|relation)\/\d{1,15}$/),
  source: z.literal("OSM"),
  name: z.string().min(1).max(200),
  sector: z.string().max(60),
  city: z.string().max(60),
  neighborhood: short(120),
  phone: short(40),
  whatsapp: short(200),
  website: z.string().min(1).max(SITE_URL_MAX),
  email: short(200),
  instagram: short(200),
  facebook: short(300),
  mapsUrl: z.string().regex(/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d{1,15}$/).nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().nullable(),
}).strict();

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("info") }).strict(),
  z.object({ action: z.literal("search"), sector: z.string().min(1).max(60), cursor: z.number().int().min(0).max(1_000_000).default(0) }).strict(),
  z.object({ action: z.literal("audit"), candidates: z.array(candidate).min(1).max(AUDIT_CHUNK) }).strict(),
]);

/**
 * Batch discovery, step by step. Read-only: nothing is saved, no AI, no paid API, no message.
 * Owner or admin only. Importing goes through the existing import route, which rechecks duplicates.
 */
export async function POST(req: Request) {
  const auth = await requireOwnerOrAdmin();
  if (auth.response) return auth.response;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    if (parsed.data.action === "info") {
      // How many businesses with a website each sector has, and how fresh the list is. No business data.
      try {
        const d = await loadDataset();
        const withWebsite = Object.fromEntries(Object.entries(d.sectors).map(([k, v]) => [k, v.withWebsite]));
        return NextResponse.json({ installed: true, osmDataUntil: d.osmDataUntil, generatedAt: d.generatedAt, withWebsite });
      } catch (err) {
        if (err instanceof DatasetMissingError) return NextResponse.json({ installed: false });
        throw err;
      }
    }
    if (parsed.data.action === "search") {
      if (!searchPerUser.check(auth.session.userId).allowed || !searchGlobal.check("all").allowed) {
        return NextResponse.json({ error: "Too many searches. Wait a minute before searching again." }, { status: 429 });
      }
      return NextResponse.json(await searchBatch(parsed.data.sector, parsed.data.cursor));
    }
    if (!auditPerUser.check(auth.session.userId).allowed) {
      return NextResponse.json({ error: "Too many checks. Wait a minute." }, { status: 429 });
    }
    return NextResponse.json({ audited: await auditChunk(parsed.data.candidates) });
  } catch (err) {
    if (err instanceof UnknownSectorError) return NextResponse.json({ error: "Unknown sector" }, { status: 400 });
    console.error("[batch-discovery] step failed");
    return NextResponse.json({ error: "That step failed. Try again." }, { status: 500 });
  }
}
