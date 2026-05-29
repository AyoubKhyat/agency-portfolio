import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createProspect } from "@/lib/dal";

const STATUS_MAP: Record<string, string> = {
  "à envoyer": "A_ENVOYER",
  "a envoyer": "A_ENVOYER",
  "envoye": "ENVOYE",
  "envoyé": "ENVOYE",
  "repondu": "REPONDU",
  "répondu": "REPONDU",
  "pas de whatsapp": "PAS_DE_WHATSAPP",
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += char;
  }
  result.push(current.trim());
  return result;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = (await file.text()).replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return NextResponse.json({ error: "Empty CSV" }, { status: 400 });

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const nameIdx = headers.findIndex((h) => h === "nom");
  const phoneIdx = headers.findIndex((h) => h.includes("telephone") || h.includes("téléphone"));
  const whatsappIdx = headers.findIndex((h) => h.includes("whatsapp"));
  const sectorIdx = headers.findIndex((h) => h.includes("secteur"));
  const neighborhoodIdx = headers.findIndex((h) => h.includes("quartier"));
  const instagramIdx = headers.findIndex((h) => h.includes("instagram"));
  const websiteIdx = headers.findIndex((h) => h.includes("site web"));
  const priorityIdx = headers.findIndex((h) => h.includes("priorit"));
  const statusIdx = headers.findIndex((h) => h.includes("statut"));
  const sentIdx = headers.findIndex((h) => h.includes("date envoi") || h.includes("date"));
  const notesIdx = headers.findIndex((h) => h === "notes");

  if (nameIdx === -1) return NextResponse.json({ error: "Column 'Nom' not found" }, { status: 400 });

  let imported = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = cols[nameIdx] || "";
    if (!name) continue;

    const phone = phoneIdx >= 0 ? cols[phoneIdx] || "" : "";
    const whatsapp = whatsappIdx >= 0 ? cols[whatsappIdx] || "" : "";
    const sector = sectorIdx >= 0 ? cols[sectorIdx] || "" : "";
    const neighborhood = neighborhoodIdx >= 0 ? cols[neighborhoodIdx] || "" : "";
    const instagram = instagramIdx >= 0 ? cols[instagramIdx] || "" : "";
    const websiteRaw = websiteIdx >= 0 ? (cols[websiteIdx] || "").toLowerCase() : "";
    const hasWebsite = websiteRaw === "oui" || websiteRaw === "yes" || websiteRaw === "true";
    const priorityRaw = priorityIdx >= 0 ? cols[priorityIdx] || "" : "";
    const priority = parseInt(priorityRaw.replace(/\D.*/, "")) || 2;
    const statusRaw = statusIdx >= 0 ? (cols[statusIdx] || "").toLowerCase().trim() : "";
    const status = STATUS_MAP[statusRaw] || "A_ENVOYER";
    const sentRaw = sentIdx >= 0 ? cols[sentIdx] || "" : "";
    const sentAt = sentRaw ? new Date(sentRaw) : null;
    const noteContent = notesIdx >= 0 ? cols[notesIdx] || "" : "";

    try {
      const whatsappLink = whatsapp || (phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "");
      await createProspect({
        name,
        phone,
        whatsappLink,
        sector,
        neighborhood,
        instagram,
        hasWebsite,
        priority,
        status,
        sentAt: sentAt && !isNaN(sentAt.getTime()) ? sentAt : null,
      });
      imported++;

      if (noteContent) {
        const { addProspectNote } = await import("@/lib/dal");
        const prospects = await (await import("@/lib/dal")).getProspects(1, undefined, undefined);
        const latest = prospects.prospects.find((p) => p.name === name);
        if (latest) await addProspectNote(latest.id, noteContent);
      }
    } catch (err) {
      errors.push(`Row ${i + 1} (${name}): ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({ imported, errors });
}
