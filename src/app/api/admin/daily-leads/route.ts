import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, requireTeam, sessionIsOwner } from "@/lib/authz";
import { hasPrisma } from "@/lib/prisma";
import { casablancaDay } from "@/lib/daily-leads";
import { getTodayLeads, importCandidate, markImported } from "@/lib/daily-leads-store";
import { runDailyLeadsNow } from "@/lib/daily-leads-run";
import { importCandidates } from "@/lib/prospect-import";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Today's leads from the Daily Lead Agent. Read-only for any team member. */
export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });
  try {
    const view = await getTodayLeads(casablancaDay(new Date()));
    const canRun = isAdmin(auth.session) || (await sessionIsOwner(auth.session));
    return NextResponse.json({ ...view, canRun });
  } catch {
    return NextResponse.json({ error: "Couldn't load today's leads" }, { status: 500 });
  }
}

const schema = z.discriminatedUnion("action", [
  // Prepare (or, after a failure, retry) today's list now. Owner or admin only. Never repeats a completed day.
  z.object({ action: z.literal("run") }).strict(),
  // Import one of today's leads through the shared import helper, which re-checks duplicates. Any team member may
  // do this (the bulk import API is owner or admin only); the candidate is built here from the stored lead.
  z.object({ action: z.literal("import"), resultId: z.string().min(1).max(64) }).strict(),
]);

export async function POST(req: Request) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.action === "run") {
    if (!isAdmin(auth.session) && !(await sessionIsOwner(auth.session))) {
      return NextResponse.json({ error: "Only the owner or an admin can do this" }, { status: 403 });
    }
    try {
      const r = await runDailyLeadsNow({ retry: true });
      return NextResponse.json({ result: r.result, leads: r.leads, checked: r.checked, error: r.error ?? null });
    } catch {
      return NextResponse.json({ error: "The run failed. Try again later." }, { status: 500 });
    }
  }

  // Import: only a lead of today's list, only once.
  const resultId = parsed.data.resultId;
  try {
    const view = await getTodayLeads(casablancaDay(new Date()));
    const lead = view.leads.find((l) => l.resultId === resultId);
    if (!lead) return NextResponse.json({ error: "That lead isn't in today's list" }, { status: 404 });
    if (lead.importedProspectId) return NextResponse.json({ prospectId: lead.importedProspectId, already: true });

    const out = await importCandidates({ candidates: [importCandidate(lead)], allowPossibleDuplicates: false }, auth.session);
    if (out.status !== 200) return NextResponse.json({ error: out.body.error ?? "Import failed" }, { status: out.status });
    const created = out.body.created[0];
    if (!created) return NextResponse.json({ skipped: out.body.skippedDetails[0]?.reason ?? "Not imported" }, { status: 409 });
    await markImported(resultId, created.id, auth.session);
    return NextResponse.json({ prospectId: created.id });
  } catch {
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
