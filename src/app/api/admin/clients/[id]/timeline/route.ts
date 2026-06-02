import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * Aggregates every event linked to a client into a single chronological feed.
 *
 * Pulls from: ClientNote, ClientActivity, Meeting, Contract, Proposal, Task
 * (parentType=CLIENT). Each row is tagged with a `kind` discriminator so the UI
 * can render it with the right icon, color and metadata.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, prospectId: true } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [notes, activities, meetings, contracts, proposals, tasks] = await Promise.all([
    prisma.clientNote.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" } }),
    prisma.clientActivity.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" } }),
    prisma.meeting.findMany({
      where: { OR: [{ clientId: id }, ...(client.prospectId ? [{ prospectId: client.prospectId }] : [])] },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contract.findMany({
      where: { OR: [{ clientId: id }, ...(client.prospectId ? [{ prospectId: client.prospectId }] : [])] },
      orderBy: { createdAt: "desc" },
    }),
    prisma.proposal.findMany({
      where: { OR: [{ clientId: id }, ...(client.prospectId ? [{ prospectId: client.prospectId }] : [])] },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { parentType: "CLIENT", parentId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  type Item = {
    id: string;
    kind: "note" | "activity" | "meeting" | "contract" | "proposal" | "task";
    ts: string;
    [k: string]: unknown;
  };

  const items: Item[] = [];

  for (const n of notes) {
    items.push({ id: `note-${n.id}`, kind: "note", ts: n.createdAt.toISOString(), content: n.content, authorName: n.authorName });
  }
  for (const a of activities) {
    // Skip NOTE_ADDED activities — the note itself is in the timeline already.
    if (a.actionType === "NOTE_ADDED") continue;
    items.push({ id: `act-${a.id}`, kind: "activity", ts: a.createdAt.toISOString(), actionType: a.actionType, details: a.details, userName: a.userName });
  }
  for (const m of meetings) {
    items.push({
      id: `mt-${m.id}`,
      kind: "meeting",
      ts: (m.updatedAt > m.createdAt ? m.updatedAt : m.createdAt).toISOString(),
      meetingId: m.id, title: m.title, type: m.type, status: m.status,
      startAt: m.startAt.toISOString(), outcome: m.outcome, ownerName: m.ownerName,
    });
  }
  for (const c of contracts) {
    items.push({
      id: `ct-${c.id}`,
      kind: "contract",
      ts: (c.updatedAt > c.createdAt ? c.updatedAt : c.createdAt).toISOString(),
      contractId: c.id, title: c.title, status: c.status,
      amount: c.amount, currency: c.currency,
      signedDate: c.signedDate?.toISOString() ?? null,
      createdByName: c.createdByName,
    });
  }
  for (const p of proposals) {
    items.push({
      id: `pr-${p.id}`,
      kind: "proposal",
      ts: (p.updatedAt > p.createdAt ? p.updatedAt : p.createdAt).toISOString(),
      proposalId: p.id, packageName: p.packageName, status: p.status,
      amount: p.amount, currency: p.currency,
      sentAt: p.sentAt?.toISOString() ?? null,
      createdByName: p.createdByName,
    });
  }
  for (const t of tasks) {
    items.push({
      id: `tk-${t.id}`,
      kind: "task",
      ts: (t.completedAt ?? t.createdAt).toISOString(),
      taskId: t.id, title: t.title, status: t.status, priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      ownerName: t.ownerName, createdByName: t.createdByName,
      completedAt: t.completedAt?.toISOString() ?? null,
    });
  }

  items.sort((a, b) => b.ts.localeCompare(a.ts));
  return NextResponse.json(items);
}
