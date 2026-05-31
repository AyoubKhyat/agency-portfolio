import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUsers, createUser } from "@/lib/dal";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await getUsers();
  return NextResponse.json(users);
}

const createSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "sales", "designer", "developer"]),
  avatarInitials: z.string().min(1).max(3),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const user = await createUser(parsed.data);
  return NextResponse.json(user, { status: 201 });
}
