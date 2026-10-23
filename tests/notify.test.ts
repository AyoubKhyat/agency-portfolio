/**
 * New-lead admin alerts (existing Notification model): right recipients, and
 * never twice for the same lead. Prisma is faked; no database is touched.
 * Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const fake = {
  available: true,
  notifications: [] as { userId: string; type: string; link: string | null }[],
  admins: ["admin1", "admin2"],
  fail: false,
};

mock.module("@/lib/prisma", {
  namedExports: {
    hasPrisma: () => fake.available,
    prisma: {
      notification: {
        count: async ({ where }: { where: { type: string; link: string } }) =>
          fake.notifications.filter((n) => n.type === where.type && n.link === where.link).length,
        createMany: async ({ data }: { data: { userId: string; type: string; link: string | null }[] }) => {
          if (fake.fail) throw new Error("db down");
          fake.notifications.push(...data);
          return { count: data.length };
        },
      },
      user: { findMany: async () => fake.admins.map((id) => ({ id })) },
    },
  },
});
mock.module("@/lib/mentions", { namedExports: { extractMentions: () => [] } });

const notify = import("../src/lib/notify");
const lead = (id: string, assignedToId?: string | null) => ({ id, fullName: "Visitor", subject: "Sites Web", assignedToId });

test("assigned lead: only the assignee is alerted, with a link to the lead", async () => {
  fake.notifications = [];
  const { notifyNewLead } = await notify;
  assert.equal(await notifyNewLead(lead("l1", "sales1")), 1);
  assert.deepEqual(fake.notifications.map((n) => [n.userId, n.type, n.link]), [["sales1", "NEW_LEAD", "/admin/leads/l1"]]);
});

test("unassigned lead: every active admin is alerted", async () => {
  fake.notifications = [];
  const { notifyNewLead } = await notify;
  assert.equal(await notifyNewLead(lead("l2", null)), 2);
  assert.deepEqual(fake.notifications.map((n) => n.userId).sort(), ["admin1", "admin2"]);
});

test("the same lead is never notified twice (retries are no-ops)", async () => {
  fake.notifications = [];
  const { notifyNewLead } = await notify;
  await notifyNewLead(lead("l3", "sales1"));
  assert.equal(await notifyNewLead(lead("l3", "sales1")), 0);
  assert.equal(await notifyNewLead(lead("l3", null)), 0);
  assert.equal(fake.notifications.length, 1);
});

test("no database or a failing write never breaks the inquiry", async () => {
  const { notifyNewLead } = await notify;
  fake.available = false;
  assert.equal(await notifyNewLead(lead("l4", "sales1")), 0);
  fake.available = true;
  fake.fail = true;
  assert.equal(await notifyNewLead(lead("l5", "sales1")), 0);
  fake.fail = false;
});
