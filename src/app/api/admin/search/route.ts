import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export type SearchResultItem = {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  type: "prospect" | "lead" | "client" | "project" | "task" | "meeting" | "message";
};

export type SearchResponse = {
  prospects: SearchResultItem[];
  leads: SearchResultItem[];
  clients: SearchResultItem[];
  projects: SearchResultItem[];
  tasks: SearchResultItem[];
  meetings: SearchResultItem[];
  messages: SearchResultItem[];
};

const LIMIT = 5;

const empty: SearchResponse = {
  prospects: [],
  leads: [],
  clients: [],
  projects: [],
  tasks: [],
  meetings: [],
  messages: [],
};

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json(empty);

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json(empty);

  const [prospects, leads, clients, projects, tasks, meetings, messages] = await Promise.all([
    // Prospects
    prisma.prospect.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { instagram: { contains: q, mode: "insensitive" } },
          { sector: { contains: q, mode: "insensitive" } },
          { neighborhood: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, sector: true, status: true, phone: true },
      take: LIMIT,
      orderBy: { updatedAt: "desc" },
    }),

    // Leads
    prisma.lead.findMany({
      where: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { subject: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, fullName: true, email: true, status: true, subject: true },
      take: LIMIT,
      orderBy: { updatedAt: "desc" },
    }),

    // Clients
    prisma.client.findMany({
      where: {
        OR: [
          { companyName: { contains: q, mode: "insensitive" } },
          { contactPerson: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, companyName: true, contactPerson: true, industry: true, status: true },
      take: LIMIT,
      orderBy: { updatedAt: "desc" },
    }),

    // Projects (search slug + translation titles)
    prisma.project.findMany({
      where: {
        OR: [
          { slug: { contains: q, mode: "insensitive" } },
          { translations: { some: { title: { contains: q, mode: "insensitive" } } } },
        ],
      },
      select: {
        id: true,
        slug: true,
        category: true,
        status: true,
        translations: { where: { locale: "fr" }, select: { title: true }, take: 1 },
      },
      take: LIMIT,
      orderBy: { updatedAt: "desc" },
    }),

    // Tasks
    prisma.task.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, status: true, priority: true, ownerName: true },
      take: LIMIT,
      orderBy: { updatedAt: "desc" },
    }),

    // Meetings
    prisma.meeting.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, type: true, status: true, startAt: true, ownerName: true },
      take: LIMIT,
      orderBy: { startAt: "desc" },
    }),

    // Chat messages
    prisma.chatMessage.findMany({
      where: {
        content: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        content: true,
        authorName: true,
        channelId: true,
        channel: { select: { name: true } },
        createdAt: true,
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const result: SearchResponse = {
    prospects: prospects.map((p) => ({
      id: p.id,
      label: p.name,
      sublabel: [p.sector, p.status].filter(Boolean).join(" · "),
      href: `/admin/prospecting?highlight=${p.id}`,
      type: "prospect" as const,
    })),
    leads: leads.map((l) => ({
      id: l.id,
      label: l.fullName,
      sublabel: l.subject || l.email,
      href: `/admin/leads/${l.id}`,
      type: "lead" as const,
    })),
    clients: clients.map((c) => ({
      id: c.id,
      label: c.companyName,
      sublabel: [c.contactPerson, c.industry].filter(Boolean).join(" · "),
      href: `/admin/clients/${c.id}`,
      type: "client" as const,
    })),
    projects: projects.map((p) => ({
      id: p.id,
      label: p.translations[0]?.title || p.slug,
      sublabel: [p.category, p.status].filter(Boolean).join(" · "),
      href: `/admin/projects/${p.id}/edit`,
      type: "project" as const,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      label: t.title,
      sublabel: [t.priority, t.status, t.ownerName].filter(Boolean).join(" · "),
      href: `/admin/tasks?highlight=${t.id}`,
      type: "task" as const,
    })),
    meetings: meetings.map((m) => ({
      id: m.id,
      label: m.title,
      sublabel: [m.type, m.status, m.ownerName].filter(Boolean).join(" · "),
      href: `/admin/meetings?highlight=${m.id}`,
      type: "meeting" as const,
    })),
    messages: messages.map((msg) => ({
      id: msg.id,
      label: msg.content.length > 80 ? msg.content.slice(0, 80) + "..." : msg.content,
      sublabel: [msg.authorName, msg.channel.name].filter(Boolean).join(" in #"),
      href: `/admin/chat/${msg.channelId}`,
      type: "message" as const,
    })),
  };

  return NextResponse.json(result);
}
