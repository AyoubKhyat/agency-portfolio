/**
 * Moves project covers hosted on Vercel Blob to the local upload folder and rewrites Project.image.
 *
 *   DATABASE_URL=... UPLOAD_DIR=/srv/uploads npx tsx scripts/migrate-blob-covers.ts          (dry run)
 *   DATABASE_URL=... UPLOAD_DIR=/srv/uploads npx tsx scripts/migrate-blob-covers.ts --apply  (writes)
 *
 * Run it against the NEW database (the VPS copy), never against the production Neon database.
 * Safe to re-run: only rows that still point at Blob are touched.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { BLOB_HOST_SUFFIX } from "../src/lib/project-image";

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
const uploadDir = process.env.UPLOAD_DIR;
const publicPath = (process.env.UPLOAD_PUBLIC_PATH || "/uploads").replace(/\/+$/, "");

if (!url || !uploadDir) {
  console.error("ERROR: DATABASE_URL and UPLOAD_DIR are required.");
  process.exit(1);
}
if (new URL(url).hostname.endsWith(".neon.tech")) {
  console.error("ERROR: DATABASE_URL points at Neon. Run this against the new VPS database.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const projects = await prisma.project.findMany({
    where: { image: { contains: BLOB_HOST_SUFFIX } },
    select: { id: true, slug: true, image: true },
  });
  console.log(`${projects.length} project(s) with a Blob cover${apply ? "" : " (dry run, nothing written)"}`);

  let failed = 0;
  for (const p of projects) {
    const name = path.basename(new URL(p.image).pathname) || `${p.slug}.webp`;
    const target = `${publicPath}/projects/${name}`;
    console.log(`- ${p.slug}: ${p.image} -> ${target}`);
    if (!apply) continue;
    try {
      const res = await fetch(p.image);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await mkdir(path.join(uploadDir!, "projects"), { recursive: true });
      await writeFile(path.join(uploadDir!, "projects", name), Buffer.from(await res.arrayBuffer()));
      await prisma.project.update({ where: { id: p.id }, data: { image: target } });
    } catch (err) {
      failed++;
      console.error(`  FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }

  const left = await prisma.project.count({ where: { image: { contains: BLOB_HOST_SUFFIX } } });
  console.log(`Blob covers remaining: ${left}`);
  process.exitCode = failed || (apply && left) ? 1 : 0;
}

main().finally(() => prisma.$disconnect());
