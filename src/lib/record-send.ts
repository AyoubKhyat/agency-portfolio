/**
 * One real send, one record.
 *
 * A send can reach the server twice: two tabs both answer "Yes, sent", or the
 * answer to the first attempt is lost and the user tries again. The database has
 * no unique rule for this, so each prospect's sends run one at a time under a
 * lock held for the transaction, and a repeat returns the existing record.
 *
 * The same person, channel and text within the window counts as the same send.
 * Message rows are what the queue trusts, so they are the ones protected here.
 */
import { prisma } from "@/lib/prisma";

export const SAME_SEND_WINDOW_MS = 10 * 60 * 1000;

/** Keeps these locks apart from any other advisory lock on the database. */
const SEND_LOCK = 7301;

const SEND_ACTIVITIES = ["SENT_WHATSAPP", "SENT_INSTAGRAM"];

type NewMessage = {
  prospectId: string;
  templateId: string | null;
  templateKey: string | null;
  channel: string;
  body: string;
  variantLabel: string | null;
  tone: string | null;
  objective: string | null;
};

type Sender = { userId: string; fullName: string };

export async function createMessageOnce(data: NewMessage, sender: Sender) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEND_LOCK}::int, hashtext(${data.prospectId}))`;

    const now = new Date();
    const same = await tx.outreachMessage.findFirst({
      where: {
        prospectId: data.prospectId,
        channel: data.channel,
        body: data.body,
        sentById: sender.userId,
        sentAt: { gte: new Date(now.getTime() - SAME_SEND_WINDOW_MS) },
      },
      orderBy: { sentAt: "desc" },
    });
    if (same) return { message: same, duplicate: true };

    const message = await tx.outreachMessage.create({
      data: { ...data, sentById: sender.userId, sentByName: sender.fullName },
    });
    await tx.prospect.update({
      where: { id: data.prospectId },
      data: { lastActionAt: now, lastActionByUserId: sender.userId, lastActionByName: sender.fullName },
    });
    // The first-contact anchor is only ever set once.
    await tx.prospect.updateMany({ where: { id: data.prospectId, sentAt: null }, data: { sentAt: now } });
    return { message, duplicate: false };
  }, { maxWait: 10_000, timeout: 15_000 });
}

/** True when this person's send on this channel was just logged, so a repeat adds nothing to the history. */
export async function sendAlreadyLogged(prospectId: string, userId: string, actionType: string): Promise<boolean> {
  if (!SEND_ACTIVITIES.includes(actionType)) return false;
  const found = await prisma.prospectActivity.findFirst({
    where: { prospectId, userId, actionType, createdAt: { gte: new Date(Date.now() - SAME_SEND_WINDOW_MS) } },
    select: { id: true },
  });
  return !!found;
}
