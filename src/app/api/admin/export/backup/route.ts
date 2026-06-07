import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }

  try {
    // Fetch all tables in parallel
    const [
      adminUsers,
      users,
      prospects,
      prospectNotes,
      prospectActivities,
      leads,
      leadNotes,
      clients,
      clientNotes,
      clientActivities,
      clientProjects,
      projects,
      projectTranslations,
      proposals,
      contracts,
      meetings,
      tasks,
      notifications,
      channels,
      channelMembers,
      chatMessages,
      chatReactions,
      auditLogs,
    ] = await Promise.all([
      prisma.adminUser.findMany(),
      prisma.user.findMany(),
      prisma.prospect.findMany({ include: { notes: true } }),
      prisma.prospectNote.findMany(),
      prisma.prospectActivity.findMany(),
      prisma.lead.findMany({ include: { notes: true } }),
      prisma.leadNote.findMany(),
      prisma.client.findMany({ include: { notes: true, activities: true } }),
      prisma.clientNote.findMany(),
      prisma.clientActivity.findMany(),
      prisma.clientProject.findMany(),
      prisma.project.findMany({ include: { translations: true } }),
      prisma.projectTranslation.findMany(),
      prisma.proposal.findMany(),
      prisma.contract.findMany(),
      prisma.meeting.findMany(),
      prisma.task.findMany(),
      prisma.notification.findMany(),
      prisma.channel.findMany({ include: { members: true } }),
      prisma.channelMember.findMany(),
      prisma.chatMessage.findMany(),
      prisma.chatReaction.findMany(),
      prisma.auditLog.findMany(),
    ]);

    // Strip passwordHash from users before export
    const safeAdminUsers = adminUsers.map(({ passwordHash: _, ...rest }) => rest);
    const safeUsers = users.map(({ passwordHash: _, ...rest }) => rest);

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: session.email,
      version: "1.0",
      data: {
        adminUsers: safeAdminUsers,
        users: safeUsers,
        prospects,
        prospectNotes,
        prospectActivities,
        leads,
        leadNotes,
        clients,
        clientNotes,
        clientActivities,
        clientProjects,
        projects,
        projectTranslations,
        proposals,
        contracts,
        meetings,
        tasks,
        notifications,
        channels,
        channelMembers,
        chatMessages,
        chatReactions,
        auditLogs,
      },
      counts: {
        adminUsers: safeAdminUsers.length,
        users: safeUsers.length,
        prospects: prospects.length,
        prospectNotes: prospectNotes.length,
        prospectActivities: prospectActivities.length,
        leads: leads.length,
        leadNotes: leadNotes.length,
        clients: clients.length,
        clientNotes: clientNotes.length,
        clientActivities: clientActivities.length,
        clientProjects: clientProjects.length,
        projects: projects.length,
        projectTranslations: projectTranslations.length,
        proposals: proposals.length,
        contracts: contracts.length,
        meetings: meetings.length,
        tasks: tasks.length,
        notifications: notifications.length,
        channels: channels.length,
        channelMembers: channelMembers.length,
        chatMessages: chatMessages.length,
        chatReactions: chatReactions.length,
        auditLogs: auditLogs.length,
      },
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `ibda3-backup-${timestamp}.json`;

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export/backup] Error:", err);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
