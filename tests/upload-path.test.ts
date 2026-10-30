import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveUploadPath } from "../src/lib/upload-path";

const dir = path.resolve("/srv/uploads");

test("only projects/<name>.webp inside the upload folder resolves", () => {
  assert.equal(resolveUploadPath(dir, ["projects", "cover-1a2b3c4d.webp"]), path.join(dir, "projects", "cover-1a2b3c4d.webp"));
  for (const bad of [
    ["projects", "..", "secret.webp"],
    ["projects", "../x.webp"],
    ["projects", "..%2Fx.webp"],
    ["projects", "a/b.webp"],
    ["projects", ".hidden.webp"],
    ["projects", "x.png"],
    ["projects", "x.webp.php"],
    ["other", "x.webp"],
    ["projects"],
    ["projects", "x.webp", "extra"],
    [],
  ]) {
    assert.equal(resolveUploadPath(dir, bad), null, JSON.stringify(bad));
  }
});
