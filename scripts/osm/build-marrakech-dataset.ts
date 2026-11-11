/**
 * Builds the private Marrakech business list for batch discovery from the official Geofabrik Morocco file.
 * Local and manual: nothing is scheduled, nothing touches a database, nothing is uploaded.
 *
 *   1. Download https://download.geofabrik.de/africa/morocco-latest.osm.pbf (and its .md5) somewhere temporary.
 *   2. npm run osm:marrakech -- --pbf <path to morocco-latest.osm.pbf>
 *   3. Delete the .pbf.
 *
 * Needs uv (https://docs.astral.sh/uv/) for the pinned pyosmium + shapely used by scripts/osm/extract.py.
 * --raw <file> skips step 2's extraction and builds from an extract already made (used for fixtures).
 * Output: data/osm/marrakech-businesses.json (ignored by Git; the repository is public).
 * Data © OpenStreetMap contributors, ODbL 1.0: keep the attribution wherever the data is shown.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CITIES } from "../../src/lib/discovery-providers";
import { DATASET_CITY, DATASET_FILE, buildDataset, sectorTags, type RawExtract } from "../../src/lib/osm-dataset";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const pbf = arg("pbf");
const rawFile = arg("raw");
const out = path.resolve(arg("out") ?? DATASET_FILE);
if (!pbf && !rawFile) {
  console.error("Usage: npm run osm:marrakech -- --pbf <morocco-latest.osm.pbf> [--out file]   (or --raw <extract.json>)");
  process.exit(1);
}

const city = CITIES.find((c) => c.key === DATASET_CITY)!;
const work = mkdtempSync(path.join(tmpdir(), "osm-marrakech-"));
try {
  let raw: RawExtract;
  if (rawFile) {
    raw = JSON.parse(readFileSync(rawFile, "utf8"));
  } else {
    const tagsFile = path.join(work, "tags.json");
    const extractFile = path.join(work, "raw.json");
    writeFileSync(tagsFile, JSON.stringify(sectorTags()));
    const r = spawnSync("uv", [
      "run", "--no-project", "--with", "osmium==4.3.2", "--with", "shapely==2.2.0",
      "python", "-I", path.resolve("scripts/osm/extract.py"),
      "--pbf", path.resolve(pbf!), "--wikidata", city.wikidata, "--tags", tagsFile, "--out", extractFile,
    ], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`extract.py failed (${r.error?.message ?? `exit ${r.status}`})`);
    raw = JSON.parse(readFileSync(extractFile, "utf8"));
  }

  const data = buildDataset(raw);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data));
  const withSite = Object.entries(data.sectors).filter(([, s]) => s.withWebsite > 0).sort((a, b) => b[1].withWebsite - a[1].withWebsite);
  console.log(`${data.entries.length} businesses with a website (${data.sharedWebsites} left out for sharing a website) → ${out}`);
  console.log(`OSM data until ${data.osmDataUntil ?? "unknown"} · boundary ${data.boundary.name ?? "?"} (${data.boundary.wikidata})`);
  for (const [k, s] of withSite) console.log(`  ${k.padEnd(18)} ${String(s.withWebsite).padStart(4)} of ${s.named}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
