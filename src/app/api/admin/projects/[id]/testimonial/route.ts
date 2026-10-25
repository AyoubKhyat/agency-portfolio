import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
 * The project's client testimonial (see lib/testimonial-approval):
 *   GET  — current state (any signed-in team member; admin data, never public)
 *   PUT  — save the draft (any signed-in team member); edits revoke the affected approvals
 *   POST — { action: "approve" | "revoke", locale } (admins only)
 * Approvals, revocations and edits are audited in the same transaction as the change.
 */

type Params = { params: Promise<{ id: string }> };

const serialize = (s: TestimonialState) => ({
  author: s.author,
  consent: s.consent,
  kind: s.kind,
  locales: Object.fromEntries(
    Object.entries(s.locales).map(([locale, l]) => [
      locale,
      { quote: l.quote, role: l.role, approvedAt: l.approvedAt?.toISOString() ?? null, approvedBy: l.approvedBy },
    ]),
  ),
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
    const plan = planTestimonialSave(state, parsed.data);
    if (plan.missingLocales.length > 0) {
      return NextResponse.json(
        { error: `Save the project in ${plan.missingLocales.join(", ").toUpperCase()} first, then add its testimonial.` },
        { status: 409 },
      );
    }
    let revoked: string[] = [];
    if (plan.changed) {
      revoked = await saveTestimonialDraft(id, plan, { userId: session.userId, userName: session.fullName, ipAddress: getClientIp(req) });
    }
    const next = await getTestimonialState(id);
    return NextResponse.json({ ...serialize(next!), revoked });
  } catch (e) {
    console.error("[testimonial] save failed:", e);
    return NextResponse.json({ error: "Could not save the testimonial. Please try again." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
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
      await revokeTestimonial(id, request.locale, actor);
      return NextResponse.json(serialize((await getTestimonialState(id))!));
    }

    const problem = approvalProblem(state, request.locale, request.expected);
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    if (state.locales[request.locale]?.approvedAt) return NextResponse.json(serialize(state));

    const ok = await approveTestimonial(id, request.locale, request.expected, actor, await approvalFingerprint(request.expected));
    if (!ok) {
      return NextResponse.json(
        { error: "This testimonial changed since you loaded it. Reload and review it before approving." },
        { status: 409 },
      );
    }
    return NextResponse.json(serialize((await getTestimonialState(id))!));
  } catch (e) {
    console.error("[testimonial] approval failed:", e);
    return NextResponse.json({ error: "Could not update the publication. Please try again." }, { status: 500 });
  }
}
