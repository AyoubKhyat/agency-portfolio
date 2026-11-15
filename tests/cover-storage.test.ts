import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { storeCover } from "../src/lib/project-cover";

test("with UPLOAD_DIR set, covers are written to disk and a root-relative path is returned", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "covers-"));
  process.env.UPLOAD_DIR = dir;
  delete process.env.UPLOAD_PUBLIC_PATH;
  try {
    const webp = Buffer.from("fake-webp");
    const url = await storeCover(webp, "my-project");
    assert.match(url, /^\/uploads\/projects\/my-project-[0-9a-f]{8}\.webp$/);
    const file = path.join(dir, "projects", path.basename(url));
    assert.ok(existsSync(file));
    assert.deepEqual(readFileSync(file), webp);
    // two uploads never share a URL
    assert.notEqual(await storeCover(webp, "my-project"), url);
    process.env.UPLOAD_PUBLIC_PATH = "/media/";
    assert.match(await storeCover(webp, "x"), /^\/media\/projects\/x-[0-9a-f]{8}\.webp$/);
  } finally {
    delete process.env.UPLOAD_DIR;
    delete process.env.UPLOAD_PUBLIC_PATH;
  }
});
