import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { getProspectById, updateProspectStatus, updateProspect, deleteProspect, assignProspectOwner, logProspectActivity, setProspectFirstContact, setProspectSentBy, notifyTeam } from "@/lib/dal";
import { resolveStatusChange } from "@/lib/prospect-status-guard";
import { sendAlreadyLogged } from "@/lib/record-send";
import { QUEUE_ACTIVITY_TYPES } from "@/lib/next-action";
import { checksClearedByEdit, contactCheckActivity } from "@/lib/contact-check";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const prospect = await getProspectById(id);
  if (!prospect) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(prospect);
}

const patchSchema = z.object({
  status: z.enum(["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI", "MEETING", "PROPOSAL_SENT", "NEGOTIATION", "CLIENT", "LOST"]).optional(),
  segment: z.enum(["WARM_NETWORK", "REFERRAL", "AGENCY_EU", "LUXURY_BRAND", "LEGACY_COLD"]).optional(),
  ownerUserId: z.string().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  proposalAmount: z.number().nullable().optional(),
  proposalDate: z.string().nullable().optional(),
  proposalStatus: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).nullable().optional(),
  // Manual contact verification — the ONLY way WhatsApp/Instagram reach VERIFIED
  // (no scraping, no paid API). Toggled from the prospect drawer.
  whatsappStatus: z.enum(["UNVERIFIED", "VERIFIED", "UNAVAILABLE"]).optional(),
  instagramStatus: z.enum(["UNVERIFIED", "VERIFIED", "UNAVAILABLE"]).optional(),
  actionType: z.string().optional(),
  details: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const current = await getProspectById(id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.ownerUserId !== undefined) {
    await assignProspectOwner(id, parsed.data.ownerUserId);
    await logProspectActivity({
      prospectId: id,
      userId: session.userId,
      userName: session.fullName,
      actionType: "ASSIGNED",
      details: parsed.data.ownerUserId
        ? `Assigned prospect`
        : "Unassigned prospect",
    });
  }

  if (parsed.data.followUpDate !== undefined) {
    await updateProspect(id, { followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null });
  }

  // A queue decision with no status change: "no more follow-ups", or "this was not a reply".
  const decision = parsed.data.actionType;
  if (!parsed.data.status && decision && (QUEUE_ACTIVITY_TYPES as readonly string[]).includes(decision)) {
    await logProspectActivity({ prospectId: id, userId: session.userId, userName: session.fullName, actionType: decision, details: parsed.data.details });
  }

  if (parsed.data.segment) {
    const previousSegment = (current as { segment?: string }).segment;
    await updateProspect(id, { segment: parsed.data.segment });
    if (previousSegment !== parsed.data.segment) {
      await logProspectActivity({
        prospectId: id,
        userId: session.userId,
        userName: session.fullName,
        actionType: "SEGMENT_CHANGED",
        details: `Segment: ${previousSegment ?? "—"} → ${parsed.data.segment}`,
      });
    }
  }

  // A person's check of a contact. The activity row is the record of who checked, what they saw and when.
  if (parsed.data.whatsappStatus !== undefined) {
    await updateProspect(id, { whatsappStatus: parsed.data.whatsappStatus });
    await logProspectActivity({
      prospectId: id,
      userId: session.userId,
      userName: session.fullName,
      ...contactCheckActivity("WHATSAPP", current.whatsappStatus, parsed.data.whatsappStatus),
    });
  }

  if (parsed.data.instagramStatus !== undefined) {
    await updateProspect(id, { instagramStatus: parsed.data.instagramStatus });
    await logProspectActivity({
      prospectId: id,
      userId: session.userId,
      userName: session.fullName,
      ...contactCheckActivity("INSTAGRAM", current.instagramStatus, parsed.data.instagramStatus),
    });
  }

  if (parsed.data.proposalAmount !== undefined || parsed.data.proposalDate !== undefined || parsed.data.proposalStatus !== undefined) {
    const proposalData: Record<string, unknown> = {};
    if (parsed.data.proposalAmount !== undefined) proposalData.proposalAmount = parsed.data.proposalAmount;
    if (parsed.data.proposalDate !== undefined) proposalData.proposalDate = parsed.data.proposalDate ? new Date(parsed.data.proposalDate) : null;
    if (parsed.data.proposalStatus !== undefined) proposalData.proposalStatus = parsed.data.proposalStatus;
    await updateProspect(id, proposalData);
  }

  if (parsed.data.status) {
    const previousStatus = current.status;
    const actionType = parsed.data.actionType || `STATUS_${parsed.data.status}`;
    const repeatSend = await sendAlreadyLogged(id, session.userId, actionType);

    // A send on a prospect who already replied (or moved further) records the
    // send but keeps their status — it must never drop them back to ENVOYE.
    const change = resolveStatusChange(previousStatus, parsed.data.status);
    if (change.preserved) {
      if (!repeatSend) {
        await logProspectActivity({
          prospectId: id,
          userId: session.userId,
          userName: session.fullName,
          actionType,
          previousStatus,
          newStatus: previousStatus,
          details: parsed.data.details ?? `Status kept at ${previousStatus} (send does not undo a reply)`,
        });
      }
      const unchanged = await getProspectById(id);
      return NextResponse.json({ ...unchanged, statusPreserved: true });
    }

    try {
      await updateProspectStatus(id, parsed.data.status);

      if (parsed.data.status === "ENVOYE") {
        if (!current.ownerUserId) {
          await assignProspectOwner(id, session.userId);
        }
        await setProspectSentBy(id, session.userId, session.fullName);
        await setProspectFirstContact(id, session.userId, session.fullName);
      }

      if (parsed.data.status === "REPONDU") {
        await setProspectFirstContact(id, session.userId, session.fullName);
      }

      if (!repeatSend) {
        await logProspectActivity({
          prospectId: id,
          userId: session.userId,
          userName: session.fullName,
          actionType,
          previousStatus,
          newStatus: parsed.data.status,
          details: parsed.data.details,
        });
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Status update failed" }, { status: 500 });
    }

    if (parsed.data.status === "REPONDU") {
      notifyTeam(session.userId, { type: "reply", title: `${current.name} replied`, body: `${session.fullName} got a reply from ${current.name}`, link: `/admin/prospecting/${id}` }).catch(() => {});
    }
    if (parsed.data.status === "CONVERTI" || parsed.data.status === "CLIENT") {
      notifyTeam(session.userId, { type: "conversion", title: `${current.name} converted`, body: `${session.fullName} converted ${current.name}`, link: `/admin/prospecting/${id}` }).catch(() => {});
    }

    const updated = await getProspectById(id);

    if (parsed.data.status === "ENVOYE" && !current.followUpDate) {
      return NextResponse.json({ ...updated, suggestedFollowUp: new Date(Date.now() + 3 * 86400000).toISOString() });
    }
    if (parsed.data.status === "REPONDU" && !current.followUpDate) {
      return NextResponse.json({ ...updated, suggestedFollowUp: new Date(Date.now() + 86400000).toISOString() });
    }

    return NextResponse.json(updated);
  }

  const updated = await getProspectById(id);
  return NextResponse.json(updated);
}

const updateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  whatsappLink: z.string().optional(),
  sector: z.string().min(1),
  neighborhood: z.string().optional().default(""),
  instagram: z.string().optional().default(""),
  hasWebsite: z.boolean().optional().default(false),
  priority: z.number().int().min(1).max(3).optional().default(2),
  status: z.string().optional(),
  ownerUserId: z.string().nullable().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const errors = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${v?.join(", ")}`);
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  // Do not fabricate a WhatsApp link from the phone. Only overwrite the link
  // when one is explicitly provided; otherwise leave the stored value (and its
  // verification status) untouched so an edit can't silently wipe a confirmed
  // link — and it can never invent one.
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.whatsappLink === undefined) delete data.whatsappLink;

  // A contact check belongs to the number or account a person opened: changing it clears the check.
  const current = await getProspectById(id);
  const cleared = current ? checksClearedByEdit(current, { phone: parsed.data.phone, whatsappLink: parsed.data.whatsappLink, instagram: parsed.data.instagram }) : [];
  if (cleared.includes("WHATSAPP")) data.whatsappStatus = "UNVERIFIED";
  if (cleared.includes("INSTAGRAM")) data.instagramStatus = "UNVERIFIED";

  const prospect = await updateProspect(id, data);

  for (const channel of cleared) {
    const previous = channel === "WHATSAPP" ? current?.whatsappStatus : current?.instagramStatus;
    const entry = contactCheckActivity(channel, previous, "UNVERIFIED");
    await logProspectActivity({
      prospectId: id, userId: session.userId, userName: session.fullName,
      ...entry, details: `${entry.details}: the ${channel === "WHATSAPP" ? "number" : "account"} was edited`,
    });
  }

  await logProspectActivity({
    prospectId: id,
    userId: session.userId,
    userName: session.fullName,
    actionType: "UPDATED",
    details: "Updated prospect details",
  });

  return NextResponse.json(prospect);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Only admins can delete prospects" }, { status: 403 });

  const { id } = await params;
  await deleteProspect(id);
  return NextResponse.json({ success: true });
}
