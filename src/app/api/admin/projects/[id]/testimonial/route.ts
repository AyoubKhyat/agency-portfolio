import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { getClientIp } from "@/lib/audit";
import {
  approveTestimonial,
  getTestimonialState,
  revokeTestimonial,
  saveTestimonialDraft,
} from "@/lib/dal";
import {
  approvalFingerprint,
  approvalProblem,
  approvalSchema,
  draftSchema,
  planTestimonialSave,
  type TestimonialState,
} from "@/lib/testimonial-approval";

/**
 * The project's client testimonial, one per project, shown on every language
 * (see lib/testimonial-approval):
 *   GET  — current state (any signed-in team member; admin data, never public)
 *   PUT  — save the draft (any signed-in team member); edits unpublish it
 *   POST — { action: "approve" | "revoke" } (admins only)
 * Publications, unpublications and edits are audited in the same transaction as the change.
 */

type Params = { params: Promise<{ id: string }> };

const serialize = (s: TestimonialState) => ({
  author: s.author,
  consent: s.consent,
  kind: s.kind,
  quote: s.quote,
  role: s.role,
  approvedAt: s.approvedAt?.toISOString() ?? null,
  approvedBy: s.approvedBy,
  hasCanonicalRow: s.hasCanonicalRow,
});

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

const invalid = (issues: { message: string; path: PropertyKey[] }[]) =>
  NextResponse.json({ error: issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") || "Invalid input" }, { status: 400 });

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const state = await getTestimonialState(id);
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serialize(state));
}

export async function PUT(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = draftSchema.safeParse(await readBody(req));
  if (!parsed.success) return invalid(parsed.error.issues);

  try {
    const state = await getTestimonialState(id);
    if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!state.hasCanonicalRow) {
      return NextResponse.json({ error: "Save the project in French first, then add its testimonial." }, { status: 409 });
    }
    const plan = planTestimonialSave(state, parsed.data);
    let unpublished = false;
    if (plan.changed) {
      unpublished = await saveTestimonialDraft(id, plan, { userId: session.userId, userName: session.fullName, ipAddress: getClientIp(req) });
    }
    const next = await getTestimonialState(id);
    return NextResponse.json({ ...serialize(next!), unpublished });
  } catch (e) {
    console.error("[testimonial] save failed:", e);
    return NextResponse.json({ error: "Could not save the testimonial. Please try again." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Only admins can publish or hide testimonials." }, { status: 403 });
  }
  const { id } = await params;

  const parsed = approvalSchema.safeParse(await readBody(req));
  if (!parsed.success) return invalid(parsed.error.issues);
  const request = parsed.data;
  const actor = { userId: session.userId, userName: session.fullName, ipAddress: getClientIp(req) };

  try {
    const state = await getTestimonialState(id);
    if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (request.action === "revoke") {
      await revokeTestimonial(id, actor);
      return NextResponse.json(serialize((await getTestimonialState(id))!));
    }

    const problem = approvalProblem(state, request.expected);
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    if (state.approvedAt) return NextResponse.json(serialize(state));

    const ok = await approveTestimonial(id, request.expected, actor, await approvalFingerprint(request.expected));
    if (!ok) {
      return NextResponse.json(
        { error: "This testimonial changed since you loaded it. Reload and review it before publishing." },
        { status: 409 },
      );
    }
    return NextResponse.json(serialize((await getTestimonialState(id))!));
  } catch (e) {
    console.error("[testimonial] publication failed:", e);
    return NextResponse.json({ error: "Could not update the publication. Please try again." }, { status: 500 });
  }
}
