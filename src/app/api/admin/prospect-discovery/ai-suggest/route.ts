import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { getAnthropic, SALES_AI_MODEL, MissingApiKeyError } from "@/lib/anthropic";

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    suggestions: {
      type: "array" as const,
      description: "1-3 specific recommendations for sectors/cities to target this week",
      items: {
        type: "object" as const,
        properties: {
          sector: { type: "string" as const, description: "Sector name (or 'Sector + City' if location matters)" },
          reason: { type: "string" as const, description: "1 sentence on why — cite actual data when relevant" },
          action: { type: "string" as const, description: "Concrete next step, e.g. 'Add 30 more clinics in Gueliz'" },
        },
        required: ["sector", "reason", "action"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" as const, description: "One-sentence headline insight." },
  },
  required: ["suggestions", "summary"],
  additionalProperties: false,
};

const SINCE_DAYS = 90;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const since = new Date(Date.now() - SINCE_DAYS * 86_400_000);

  // Gather sector signals
  const messages = await prisma.outreachMessage.findMany({
    where: { sentAt: { gte: since } },
    select: {
      replied: true,
      prospect: { select: { sector: true } },
    },
  });

  const uncontactedAgg = await prisma.prospect.groupBy({
    by: ["sector"],
    where: { sentAt: null },
    _count: { id: true },
  });

  const clientWins = await prisma.client.findMany({
    where: { createdAt: { gte: since }, prospectId: { not: null } },
    select: { prospect: { select: { sector: true } } },
  });

  // Build sector stats
  const sectorStats: Record<string, { sent: number; replied: number; uncontacted: number; wins: number }> = {};
  for (const m of messages) {
    const s = m.prospect?.sector;
    if (!s) continue;
    sectorStats[s] = sectorStats[s] || { sent: 0, replied: 0, uncontacted: 0, wins: 0 };
    sectorStats[s].sent++;
    if (m.replied) sectorStats[s].replied++;
  }
  for (const u of uncontactedAgg) {
    sectorStats[u.sector] = sectorStats[u.sector] || { sent: 0, replied: 0, uncontacted: 0, wins: 0 };
    sectorStats[u.sector].uncontacted = u._count.id;
  }
  for (const c of clientWins) {
    const s = c.prospect?.sector;
    if (!s) continue;
    sectorStats[s] = sectorStats[s] || { sent: 0, replied: 0, uncontacted: 0, wins: 0 };
    sectorStats[s].wins++;
  }

  const statsArray = Object.entries(sectorStats).map(([sector, s]) => ({
    sector,
    sent: s.sent,
    replied: s.replied,
    replyRate: s.sent > 0 ? Math.round((s.replied / s.sent) * 1000) / 10 : 0,
    uncontacted: s.uncontacted,
    wins: s.wins,
  }));

  // Without AI: rule-based fallback
  let client: Anthropic;
  try {
    client = getAnthropic();
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      // Fallback: pick top sector by reply rate * uncontacted
      const ranked = statsArray
        .filter((s) => s.sent >= 5)
        .sort((a, b) => b.replyRate * Math.max(b.uncontacted, 1) - a.replyRate * Math.max(a.uncontacted, 1));
      const top = ranked[0];
      return NextResponse.json({
        aiEnabled: false,
        summary: top
          ? `${top.sector} performs best (${top.replyRate}% reply rate) with ${top.uncontacted} uncontacted prospects remaining.`
          : "Not enough data yet — log more outreach to surface sector insights.",
        suggestions: ranked.slice(0, 3).map((s) => ({
          sector: s.sector,
          reason: `${s.replyRate}% reply rate over ${s.sent} sends · ${s.wins} clients won`,
          action: s.uncontacted > 0 ? `${s.uncontacted} uncontacted in this sector — work the existing list first` : "Add more prospects in this sector",
        })),
        rawStats: statsArray,
      });
    }
    throw err;
  }

  // With AI: smarter synthesis
  const systemPrompt = `You are a sales strategy advisor for Ibda3 Digital, a web agency in Marrakech.
The team is doing outbound prospecting and wants to know which sectors are worth doubling down on THIS WEEK.

You are given per-sector stats: messages sent, reply rate, uncontacted prospects, clients won.

Pick 1-3 sectors to recommend. For each:
- Cite the actual numbers from the data
- Explain why (high reply rate? underexplored? high conversion?)
- Give a concrete action (e.g., "Add 30 more clinics in Gueliz", "Work the 47 uncontacted dentists before adding more")

Rules:
- Don't recommend sectors with < 5 messages sent unless they have many uncontacted prospects waiting
- Be specific about what to DO this week — not vague advice
- If overall data is sparse (most sectors < 5 sends), say so honestly and recommend adding more prospects in a couple of well-served sectors

Output JSON per schema. Plain text in every field.`;

  const userPrompt = `Per-sector data (last ${SINCE_DAYS} days):
${JSON.stringify(statsArray, null, 2)}

Recommend 1-3 sectors to target this week.`;

  try {
    const response = await client.messages.create({
      model: SALES_AI_MODEL,
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA }, effort: "high" },
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    }

    const parsedOutput = JSON.parse(textBlock.text);
    return NextResponse.json({ aiEnabled: true, ...parsedOutput, rawStats: statsArray });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "AI request failed", message: err.message }, { status: 502 });
    }
    throw err;
  }
}
