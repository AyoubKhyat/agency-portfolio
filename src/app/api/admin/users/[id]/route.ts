import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateUser } from "@/lib/dal";
import { z } from "zod";

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "sales", "designer", "developer"]).optional(),
  avatarInitials: z.string().min(1).max(3).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const user = await updateUser(id, parsed.data);
  return NextResponse.json(user);
}
