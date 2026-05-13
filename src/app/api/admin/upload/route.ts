import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  const slug = (formData.get("slug") as string) || file.name.replace(/\.[^.]+$/, "");
  const safeName = slug
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const fileName = `${safeName}.webp`;
  const outDir = path.join(process.cwd(), "public", "projects");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, fileName);

  await sharp(buffer)
    .resize(1280, 800, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outPath);

  return NextResponse.json({ path: `/projects/${fileName}` });
}
