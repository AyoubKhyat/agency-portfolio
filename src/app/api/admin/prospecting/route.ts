import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProspects, createProspect, logProspectActivity, findDuplicateProspect } from "@/lib/dal";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const status = url.searchParams.get("status") || undefined;
  const sector = url.searchParams.get("sector") || undefined;
  const search = url.searchParams.get("search") || undefined;
  let owner = url.searchParams.get("owner") || undefined;
  if (url.searchParams.get("unassigned") === "true") owner = "UNASSIGNED";

  const result = await getProspects(page, status, sector, owner, search);
  return NextResponse.json(result);
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  whatsappLink: z.string().optional(),
  sector: z.string().min(1),
  neighborhood: z.string().optional().default(""),
  instagram: z.string().optional().default(""),
  hasWebsite: z.boolean().optional().default(false),
  priority: z.number().int().min(1).max(3).optional().default(2),
  status: z.string().optional().default("A_ENVOYER"),
  ownerUserId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const errors = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${v?.join(", ")}`);
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  // Check for duplicate by phone number or Instagram handle
  const duplicate = await findDuplicateProspect(parsed.data.phone, parsed.data.instagram);
  if (duplicate) {
    return NextResponse.json(
      {
        error: "Duplicate prospect detected",
        duplicate: {
          id: duplicate.id,
          name: duplicate.name,
          phone: duplicate.phone,
          instagram: duplicate.instagram,
          status: duplicate.status,
        },
      },
      { status: 409 }
    );
  }

  const prospect = await createProspect(parsed.data);

  await logProspectActivity({
    prospectId: prospect.id,
    userId: session.userId,
    userName: session.fullName,
    actionType: "CREATED",
    details: `Created prospect "${prospect.name}"`,
  });

  return NextResponse.json(prospect, { status: 201 });
}
