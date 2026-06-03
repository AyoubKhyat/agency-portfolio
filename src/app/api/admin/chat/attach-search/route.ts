import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * GET /api/admin/chat/attach-search?q=...
 *
 * Searches across all entity types that can be attached to a chat message:
 * Prospect, Client, ClientProject, Task, Meeting. Each result carries the
 * fields the chat composer needs to render and persist the attachment
 * (type, id, label, href).
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const [prospects, clients, projects, tasks, meetings] = await Promise.all([
    prisma.prospect.findMany({
      where: { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sector: { contains: q, mode: "insensitive" } },
        { instagram: { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, name: true, sector: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.client.findMany({
      where: { OR: [
        { companyName: { contains: q, mode: "insensitive" } },
        { industry: { contains: q, mode: "insensitive" } },
        { contactPerson: { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, companyName: true, industry: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.clientProject.findMany({
      where: { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { clientName: { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, name: true, clientName: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, status: true, parentLabel: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.meeting.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: {
        id: true, title: true, startAt: true, status: true, clientId: true, prospectId: true,
        client: { select: { id: true, companyName: true } },
        prospect: { select: { id: true, name: true } },
      },
      orderBy: { startAt: "desc" },
      take: 5,
    }),
  ]);

  const results = [
    ...prospects.map((p) => ({ type: "PROSPECT", id: p.id, label: p.name, sub: p.sector, href: `/admin/prospecting/${p.id}` })),
    ...clients.map((c) => ({ type: "CLIENT", id: c.id, label: c.companyName, sub: c.industry, href: `/admin/clients/${c.id}` })),
    ...projects.map((p) => ({ type: "PROJECT", id: p.id, label: p.name, sub: `${p.clientName} · ${p.status}`, href: `/admin/pipeline?project=${p.id}` })),
    ...tasks.map((t) => ({ type: "TASK", id: t.id, label: t.title, sub: `${t.status}${t.parentLabel ? ` · ${t.parentLabel}` : ""}`, href: `/admin/tasks?scope=all` })),
    ...meetings.map((m) => {
      const link = m.clientId ? `/admin/clients/${m.clientId}` : m.prospectId ? `/admin/prospecting/${m.prospectId}` : "#";
      const sub = (m.client?.companyName ?? m.prospect?.name ?? "—") + " · " + new Date(m.startAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
      return { type: "MEETING", id: m.id, label: m.title, sub, href: link };
    }),
  ];

  return NextResponse.json(results);
}
