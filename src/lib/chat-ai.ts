import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * Template-based AI chat assistant.
 * Detects @AI commands in chat messages and responds with real data from the database.
 */

const AI_AUTHOR_NAME = "AI Assistant";

/** Check if a message contains an @AI mention and return the command portion. */
function extractAICommand(content: string): string | null {
  const match = content.match(/@ai\s+(.*)/i);
  if (!match) return null;
  return match[1].trim();
}

/** Format a date for display. */
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<string, string> = {
  A_ENVOYER: "A envoyer",
  ENVOYE: "Envoye",
  CONTACTE: "Contacte",
  INTERESSE: "Interesse",
  RDV_PLANIFIE: "RDV planifie",
  PROPOSITION: "Proposition",
  NEGOCIE: "Negocie",
  GAGNE: "Gagne",
  PERDU: "Perdu",
  PAS_INTERESSE: "Pas interesse",
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s] || s;
}

// ---- Command handlers ----

async function handleHelp(): Promise<string> {
  return [
    "**AI Assistant - Available Commands**",
    "",
    "`@AI help` - Show this help message",
    "`@AI stats` - Today's stats: new leads, prospects, meetings, proposals",
    "`@AI status` - System health: totals for prospects, leads, tasks, meetings",
    "`@AI summarize [name]` - Summarize a prospect by name",
    "`@AI top prospects` - Top 5 prospects by most recent activity",
    "`@AI overdue` - Overdue tasks and follow-ups",
    "`@AI team` - Team workload summary",
    "",
    "Tip: commands are case-insensitive.",
  ].join("\n");
}

async function handleStats(): Promise<string> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [newLeads, prospectsSent, meetingsScheduled, proposalsSent] =
    await Promise.all([
      prisma.lead.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.prospect.count({
        where: { sentAt: { gte: todayStart } },
      }),
      prisma.meeting.count({
        where: {
          startAt: { gte: todayStart },
          status: "SCHEDULED",
        },
      }),
      prisma.proposal.count({
        where: { sentAt: { gte: todayStart } },
      }),
    ]);

  return [
    "**Today's Stats**",
    "",
    `New leads: **${newLeads}**`,
    `Prospects sent: **${prospectsSent}**`,
    `Meetings scheduled: **${meetingsScheduled}**`,
    `Proposals sent: **${proposalsSent}**`,
  ].join("\n");
}

async function handleStatus(): Promise<string> {
  const [
    totalProspects,
    totalLeads,
    activeTasks,
    upcomingMeetings,
    activeClients,
    openProposals,
  ] = await Promise.all([
    prisma.prospect.count(),
    prisma.lead.count(),
    prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } } }),
    prisma.meeting.count({
      where: { startAt: { gte: new Date() }, status: "SCHEDULED" },
    }),
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.proposal.count({
      where: { status: { in: ["DRAFT", "SENT", "PENDING"] } },
    }),
  ]);

  return [
    "**System Status**",
    "",
    `Total prospects: **${totalProspects}**`,
    `Total leads: **${totalLeads}**`,
    `Active clients: **${activeClients}**`,
    `Active tasks: **${activeTasks}**`,
    `Upcoming meetings: **${upcomingMeetings}**`,
    `Open proposals: **${openProposals}**`,
  ].join("\n");
}

async function handleSummarize(name: string): Promise<string> {
  if (!name) {
    return "Please specify a prospect name. Usage: `@AI summarize [name]`";
  }

  const prospect = await prisma.prospect.findFirst({
    where: {
      name: { contains: name, mode: "insensitive" },
    },
    include: {
      notes: { orderBy: { createdAt: "desc" }, take: 3 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
      owner: { select: { fullName: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!prospect) {
    return `No prospect found matching "**${name}**". Try a different search term.`;
  }

  const lastActivity = prospect.activities[0];
  const latestProposal = prospect.proposals[0];

  const lines = [
    `**Prospect: ${prospect.name}**`,
    "",
    `Sector: ${prospect.sector || "N/A"}`,
    `Phone: ${prospect.phone || "N/A"}`,
    `Status: **${statusLabel(prospect.status)}**`,
    `Priority: ${"*".repeat(prospect.priority)} (${prospect.priority}/5)`,
    `Owner: ${prospect.owner?.fullName || "Unassigned"}`,
    `Created: ${fmtDate(prospect.createdAt)}`,
  ];

  if (prospect.sentAt) {
    lines.push(`Sent: ${fmtDate(prospect.sentAt)}`);
  }
  if (prospect.followUpDate) {
    lines.push(`Follow-up: ${fmtDate(prospect.followUpDate)}`);
  }

  lines.push(`Notes: **${prospect.notes.length}** note(s)`);

  if (lastActivity) {
    lines.push(
      `Last activity: ${lastActivity.actionType} by ${lastActivity.userName} (${fmtDateTime(lastActivity.createdAt)})`
    );
  }

  if (latestProposal) {
    lines.push(
      "",
      `**Latest Proposal:** ${latestProposal.amount} ${latestProposal.currency} - Status: ${latestProposal.status}`
    );
  }

  return lines.join("\n");
}

async function handleTopProspects(): Promise<string> {
  const prospects = await prisma.prospect.findMany({
    orderBy: [
      { lastActionAt: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    take: 5,
    include: {
      owner: { select: { fullName: true } },
    },
  });

  if (prospects.length === 0) {
    return "No prospects found in the database.";
  }

  const lines = ["**Top 5 Prospects (by recent activity)**", ""];

  prospects.forEach((p, i) => {
    const owner = p.owner?.fullName || "Unassigned";
    const lastAction = p.lastActionAt ? fmtDateTime(p.lastActionAt) : "No activity";
    lines.push(
      `${i + 1}. **${p.name}** - ${p.sector} | Status: ${statusLabel(p.status)} | Owner: ${owner} | Last: ${lastAction}`
    );
  });

  return lines.join("\n");
}

async function handleOverdue(): Promise<string> {
  const now = new Date();

  const [overdueTasks, overdueFollowUps] = await Promise.all([
    prisma.task.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.prospect.findMany({
      where: {
        followUpDate: { lt: now },
        status: { notIn: ["GAGNE", "PERDU", "PAS_INTERESSE"] },
      },
      orderBy: { followUpDate: "asc" },
      take: 10,
    }),
  ]);

  const lines = ["**Overdue Items**", ""];

  if (overdueTasks.length > 0) {
    lines.push(`**Tasks (${overdueTasks.length}):**`);
    overdueTasks.forEach((t) => {
      lines.push(
        `- ${t.title} | Due: ${fmtDate(t.dueDate)} | Owner: ${t.ownerName || "Unassigned"} | ${t.priority}`
      );
    });
  } else {
    lines.push("No overdue tasks.");
  }

  lines.push("");

  if (overdueFollowUps.length > 0) {
    lines.push(`**Follow-ups (${overdueFollowUps.length}):**`);
    overdueFollowUps.forEach((p) => {
      lines.push(
        `- ${p.name} | Follow-up was: ${fmtDate(p.followUpDate)} | Status: ${statusLabel(p.status)}`
      );
    });
  } else {
    lines.push("No overdue follow-ups.");
  }

  return lines.join("\n");
}

async function handleTeam(): Promise<string> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true,
      role: true,
    },
  });

  if (users.length === 0) {
    return "No active team members found.";
  }

  const lines = ["**Team Workload Summary**", ""];

  for (const user of users) {
    const [openTasks, activeProspects, upcomingMeetings] = await Promise.all([
      prisma.task.count({
        where: { ownerId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } },
      }),
      prisma.prospect.count({
        where: {
          ownerUserId: user.id,
          status: { notIn: ["GAGNE", "PERDU", "PAS_INTERESSE"] },
        },
      }),
      prisma.meeting.count({
        where: {
          ownerId: user.id,
          startAt: { gte: new Date() },
          status: "SCHEDULED",
        },
      }),
    ]);

    const total = openTasks + activeProspects + upcomingMeetings;
    const load =
      total === 0 ? "Available" : total <= 3 ? "Light" : total <= 8 ? "Moderate" : "Busy";

    lines.push(
      `**${user.fullName}** (${user.role}) - ${load}`,
      `  Tasks: ${openTasks} | Prospects: ${activeProspects} | Meetings: ${upcomingMeetings}`,
      ""
    );
  }

  return lines.join("\n");
}

// ---- Main entry point ----

/**
 * Process a chat message for @AI commands.
 * Returns the AI response text, or null if the message is not an AI command.
 */
export async function processAICommand(
  content: string
): Promise<string | null> {
  const command = extractAICommand(content);
  if (!command) return null;

  if (!hasPrisma()) {
    return "AI Assistant is unavailable - database is not connected.";
  }

  const lower = command.toLowerCase();

  try {
    if (lower === "help") {
      return handleHelp();
    }
    if (lower === "stats") {
      return handleStats();
    }
    if (lower === "status") {
      return handleStatus();
    }
    if (lower.startsWith("summarize")) {
      const name = command.replace(/^summarize\s*/i, "").trim();
      return handleSummarize(name);
    }
    if (lower === "top prospects" || lower === "top") {
      return handleTopProspects();
    }
    if (lower === "overdue") {
      return handleOverdue();
    }
    if (lower === "team") {
      return handleTeam();
    }

    // Unknown command
    return [
      `I don't recognize the command "**${command}**".`,
      "",
      "Type `@AI help` to see available commands.",
    ].join("\n");
  } catch (err) {
    console.error("[chat-ai] Error processing command:", err);
    return "Sorry, something went wrong while processing your request. Please try again.";
  }
}

export { AI_AUTHOR_NAME };
