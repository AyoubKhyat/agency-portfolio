/**
 * Outreach module — data layer (Phase 2.2b).
 *
 * Self-contained: the workspace DTO/resolver are frozen, so this module owns its
 * own read/generate/save endpoints. It reuses everything already built —
 * the AI provider abstraction (with Mock fallback), and the cached draft fields
 * that already live on DiscoveryResult (emailSubject / emailBody / whatsappBody).
 *
 * Draft store: a DiscoveryResult row.
 *   - discovery workspace → the result itself.
 *   - prospect workspace  → its originating DiscoveryResult (importedProspectId).
 *   - manual prospect (no origin) → no persistent store; drafts still generate
 *     and are usable in-session, but Save is unavailable (no schema change).
 *
 * No sending, no queues, no scheduling — drafting only.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { getAiProvider } from "@/lib/ai";
import type { WorkspaceSource } from "@/lib/workspace/types";

export type OutreachChannel = "email" | "whatsapp";

export type OutreachData = {
  email: { subject: string; body: string; exists: boolean; valid: boolean };
  whatsapp: { body: string; exists: boolean; valid: boolean };
  /** False for a manual prospect with no Discovery origin — Save is disabled. */
  canPersist: boolean;
};

type Store = {
  storeId: string | null;
  emailSubject: string;
  emailBody: string;
  whatsappBody: string;
  emailValid: boolean;
  whatsappValid: boolean;
  meta: { name: string; sector: string; city: string; country: string; suggestedOffer: string };
};

const DRAFT_SELECT = {
  id: true, name: true, sector: true, city: true, country: true, suggestedOffer: true,
  emailSubject: true, emailBody: true, whatsappBody: true, emailValid: true, whatsappValid: true,
} as const;

function languageFor(country: string): "fr" | "en" {
  return country === "France" || country === "Monaco" || country === "Belgium" ? "fr" : "en";
}

async function resolveStore(source: WorkspaceSource, id: string): Promise<Store | null> {
  if (source === "discovery") {
    const r = await prisma.discoveryResult.findUnique({ where: { id }, select: DRAFT_SELECT });
    if (!r) return null;
    return {
      storeId: r.id,
      emailSubject: r.emailSubject, emailBody: r.emailBody, whatsappBody: r.whatsappBody,
      emailValid: r.emailValid, whatsappValid: r.whatsappValid,
      meta: { name: r.name, sector: r.sector, city: r.city, country: r.country, suggestedOffer: r.suggestedOffer },
    };
  }

  const p = await prisma.prospect.findUnique({
    where: { id },
    select: { id: true, name: true, sector: true, neighborhood: true, email: true, whatsappLink: true },
  });
  if (!p) return null;

  const origin = await prisma.discoveryResult.findFirst({
    where: { importedProspectId: id },
    orderBy: { createdAt: "asc" },
    select: DRAFT_SELECT,
  });
  if (origin) {
    return {
      storeId: origin.id,
      emailSubject: origin.emailSubject, emailBody: origin.emailBody, whatsappBody: origin.whatsappBody,
      emailValid: origin.emailValid, whatsappValid: origin.whatsappValid,
      meta: {
        name: origin.name || p.name,
        sector: origin.sector || p.sector,
        city: origin.city || p.neighborhood,
        country: origin.country || "Morocco",
        suggestedOffer: origin.suggestedOffer,
      },
    };
  }

  // Manual prospect — no persistent draft store.
  return {
    storeId: null,
    emailSubject: "", emailBody: "", whatsappBody: "",
    emailValid: Boolean(p.email), whatsappValid: Boolean(p.whatsappLink),
    meta: { name: p.name, sector: p.sector, city: p.neighborhood || "Marrakech", country: "Morocco", suggestedOffer: "" },
  };
}

export async function getOutreach(source: WorkspaceSource, id: string): Promise<OutreachData | null> {
  const s = await resolveStore(source, id);
  if (!s) return null;
  return {
    email: { subject: s.emailSubject, body: s.emailBody, exists: Boolean(s.emailSubject || s.emailBody), valid: s.emailValid },
    whatsapp: { body: s.whatsappBody, exists: Boolean(s.whatsappBody), valid: s.whatsappValid },
    canPersist: s.storeId != null,
  };
}

export async function generateOutreach(
  source: WorkspaceSource, id: string, channel: OutreachChannel, regenerate: boolean,
): Promise<{ subject?: string; body: string; canPersist: boolean } | null> {
  const s = await resolveStore(source, id);
  if (!s) return null;

  // Reuse the cached draft unless an explicit regenerate is requested.
  if (!regenerate) {
    if (channel === "email" && (s.emailSubject || s.emailBody)) {
      return { subject: s.emailSubject, body: s.emailBody, canPersist: s.storeId != null };
    }
    if (channel === "whatsapp" && s.whatsappBody) {
      return { body: s.whatsappBody, canPersist: s.storeId != null };
    }
  }

  const provider = getAiProvider();
  const input = {
    businessName: s.meta.name, sector: s.meta.sector, city: s.meta.city,
    country: s.meta.country, language: languageFor(s.meta.country), suggestedOffer: s.meta.suggestedOffer,
  };

  if (channel === "email") {
    const draft = await provider.generateOutreachEmail(input);
    if (s.storeId) {
      await prisma.discoveryResult.update({ where: { id: s.storeId }, data: { emailSubject: draft.subject, emailBody: draft.body } });
    }
    return { subject: draft.subject, body: draft.body, canPersist: s.storeId != null };
  }

  const body = await provider.generateOutreachWhatsApp(input);
  if (s.storeId) {
    await prisma.discoveryResult.update({ where: { id: s.storeId }, data: { whatsappBody: body } });
  }
  return { body, canPersist: s.storeId != null };
}

export async function saveOutreach(
  source: WorkspaceSource, id: string, channel: OutreachChannel, subject: string, body: string,
): Promise<{ ok: boolean; reason?: "not-found" | "no-store" }> {
  const s = await resolveStore(source, id);
  if (!s) return { ok: false, reason: "not-found" };
  if (!s.storeId) return { ok: false, reason: "no-store" };

  if (channel === "email") {
    await prisma.discoveryResult.update({ where: { id: s.storeId }, data: { emailSubject: subject, emailBody: body } });
  } else {
    await prisma.discoveryResult.update({ where: { id: s.storeId }, data: { whatsappBody: body } });
  }
  return { ok: true };
}

/* ─────────────────────────── Route handlers (shared by both sources) ─────────────────────────── */

const postSchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  regenerate: z.boolean().optional().default(false),
});

const putSchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  subject: z.string().optional().default(""),
  body: z.string(),
});

type Ctx = { params: Promise<{ id: string }> };

export function makeOutreachHandlers(source: WorkspaceSource) {
  return {
    async GET(_req: Request, { params }: Ctx) {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
      const { id } = await params;
      const data = await getOutreach(source, id);
      if (!data) return NextResponse.json({ error: "Company not found" }, { status: 404 });
      return NextResponse.json(data);
    },

    async POST(req: Request, { params }: Ctx) {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
      const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      const { id } = await params;
      const draft = await generateOutreach(source, id, parsed.data.channel, parsed.data.regenerate);
      if (!draft) return NextResponse.json({ error: "Company not found" }, { status: 404 });
      return NextResponse.json(draft);
    },

    async PUT(req: Request, { params }: Ctx) {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
      const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      const { id } = await params;
      const res = await saveOutreach(source, id, parsed.data.channel, parsed.data.subject, parsed.data.body);
      if (!res.ok && res.reason === "not-found") return NextResponse.json({ error: "Company not found" }, { status: 404 });
      if (!res.ok && res.reason === "no-store") return NextResponse.json({ error: "This lead has no draft store — Save is unavailable." }, { status: 422 });
      return NextResponse.json({ ok: true });
    },
  };
}
