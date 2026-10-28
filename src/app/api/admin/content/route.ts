import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";
import { contentCreateSchema, firstContentError, planContentCreate } from "@/lib/content-posts";

/**
 * Instagram Content Planner (see lib/content-posts for the workflow rules).
 *   GET  — every post, soonest planned first; ?archived=true lists the archive instead
 *   POST — create a post (never as Published)
 * Any signed-in team member. Filtering and counts happen in the UI over this list.
 */

const LIMIT = 500;

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ posts: [], archivedCount: 0 });

  const archived = new URL(req.url).searchParams.get("archived") === "true";

  const [posts, archivedCount] = await Promise.all([
    prisma.contentPost.findMany({
      where: { archivedAt: archived ? { not: null } : null },
      orderBy: [{ plannedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: LIMIT,
    }),
    prisma.contentPost.count({ where: { archivedAt: { not: null } } }),
  ]);

  return NextResponse.json({ posts, archivedCount });
}

export async function POST(req: Request) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const { session } = auth;

  const parsed = contentCreateSchema.safeParse(await readBody(req));
  if (!parsed.success) return NextResponse.json({ error: firstContentError(parsed.error) }, { status: 400 });

  const plan = planContentCreate(parsed.data);
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });

  const post = await prisma.contentPost.create({
    data: { ...plan.data, createdById: session.userId, createdByName: session.fullName },
  });
  return NextResponse.json(post, { status: 201 });
}
