import { z } from "zod";
import { createLead, findRecentDuplicateLead, getLeastLoadedUser } from "@/lib/dal";
import { dispatchWebhook } from "@/lib/webhooks";
import { notifyNewLead } from "@/lib/notify";

/** Where a contact lead is created, de-duplicated, assigned and announced. Used by the public form and by the internal API. */
export const leadSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(5000),
  website: z.string().optional(),
});

/** The same email + message + selected service inside this window is one inquiry, not a new lead. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export type Saved = { leadId: string | null; duplicate: boolean };

// Identical submissions arriving at the same time on this instance share one save
// (and its failure): only the first creates the lead and its notification.
const inFlight = new Map<string, Promise<Saved>>();

export async function intakeLead(data: z.infer<typeof leadSchema>): Promise<Saved> {
  const { fullName, email, phone, subject, message } = data;
  const key = `${email.toLowerCase()}\n${subject}\n${message}`;
  const pending = inFlight.get(key);
  if (pending) return { leadId: (await pending).leadId, duplicate: true };

  const work = (async () => {
    const existing = await findRecentDuplicateLead(email, message, subject, new Date(Date.now() - DUPLICATE_WINDOW_MS));
    if (existing) return { leadId: existing, duplicate: true } as Saved;

    // Auto-assign lead to the team member with the fewest leads (round-robin)
    let assignedToId: string | undefined;
    let assignedToName: string | undefined;
    try {
      const leastLoaded = await getLeastLoadedUser();
      if (leastLoaded) {
        assignedToId = leastLoaded.id;
        assignedToName = leastLoaded.fullName;
      }
    } catch {
      // If user lookup fails, create lead without assignment
    }

    const lead = await createLead({
      fullName,
      email,
      phone: phone || undefined,
      subject,
      message,
      assignedToId,
      assignedToName,
    });

    await notifyNewLead({ id: lead.id, fullName, subject, assignedToId });

    // Fire webhook for new lead
    dispatchWebhook("lead.new", {
      id: lead.id,
      fullName,
      email,
      phone: phone || null,
      subject,
      message,
      assignedToName: assignedToName || null,
    });
    return { leadId: lead.id, duplicate: false } as Saved;
  })();

  inFlight.set(key, work);
  work.catch(() => {}); // the caller below observes the failure
  try {
    return await work;
  } finally {
    inFlight.delete(key);
  }
}
