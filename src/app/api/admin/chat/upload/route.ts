import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const channelId = formData.get("channelId") as string | null;
  const content = (formData.get("content") as string) || "";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!channelId) return NextResponse.json({ error: "No channelId" }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only images (JPEG, PNG, GIF, WebP) and PDF allowed" }, { status: 400 });
  }

  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: session.userId } },
  });
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  const message = await prisma.chatMessage.create({
    data: {
      channelId,
      authorId: session.userId,
      authorName: session.fullName,
      content: content || file.name,
      fileUrl: dataUrl,
      fileName: file.name,
      fileType: file.type,
    },
    include: { reactions: true },
  });

  await prisma.channelMember.update({
    where: { channelId_userId: { channelId, userId: session.userId } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json(message, { status: 201 });
}
