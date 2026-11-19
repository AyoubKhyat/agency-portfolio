import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { firstMessageHref } from "../src/lib/workspace/first-message";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const WORKSPACE = "src/components/admin/workspace/workspace-view.tsx";
const DRAWER = "src/components/admin/prospect-drawer.tsx";

const imported = { prospectId: "p_imported", importedAt: null, importedByName: null };

test("an imported prospect's workspace links to its draft panel", () => {
  assert.equal(firstMessageHref({ source: "prospect", id: "p_imported", imported: null }), "/admin/prospecting/p_imported#draft");
});

test("a prospect created by hand (no Discovery origin) also links to its draft panel", () => {
  assert.equal(firstMessageHref({ source: "prospect", id: "p_manual", imported: null }), "/admin/prospecting/p_manual#draft");
});

test("a Discovery result that was imported links to the prospect it became, not to itself", () => {
  assert.equal(firstMessageHref({ source: "discovery", id: "d_1", imported }), "/admin/prospecting/p_imported#draft");
});

test("a Discovery-only result has nowhere to draft: import comes first", () => {
  assert.equal(firstMessageHref({ source: "discovery", id: "d_2", imported: null }), null);
});

test("the id is encoded into the link", () => {
  assert.equal(firstMessageHref({ source: "prospect", id: "a/b?c", imported: null }), "/admin/prospecting/a%2Fb%3Fc#draft");
});

test("the workspace Outreach module calls no outreach endpoint and can't generate, edit or save", () => {
  const src = read(WORKSPACE);
  assert.doesNotMatch(src, /\/outreach`/, "no request to /api/admin/workspace/.../outreach");
  assert.doesNotMatch(src, /method:\s*"(POST|PUT)"/, "no write request from the workspace");
  for (const gone of ["Save Draft", "Regenerate", "Generate draft", "<textarea", "clipboard"]) {
    assert.ok(!src.includes(gone), `legacy outreach UI removed: ${gone}`);
  }
  assert.match(src, /firstMessageHref\(data\)/);
  assert.match(src, /data-testid="outreach-prospect-link"/);
  assert.match(src, /data-testid="outreach-import-required"/);
  assert.match(src, /id="outreach"/, "the module keeps its anchor for the module index");
});

test("the legacy outreach API is unchanged: both routes still serve GET, POST and PUT", () => {
  for (const source of ["prospect", "discovery"]) {
    const route = read(`src/app/api/admin/workspace/${source}/[id]/outreach/route.ts`);
    assert.match(route, new RegExp(`export const \\{ GET, POST, PUT \\} = makeOutreachHandlers\\("${source}"\\)`));
  }
  const lib = read("src/lib/workspace/outreach.ts");
  assert.match(lib, /export function makeOutreachHandlers/);
  assert.match(lib, /emailSubject: subject, emailBody: body/, "saved drafts still live on the Discovery result");
});

test("the prospect drawer links to the prospect page beside Open Workspace", () => {
  const src = read(DRAWER);
  const page = src.indexOf("href={`/admin/prospecting/${prospect.id}`}");
  const workspace = src.indexOf("href={`/admin/workspace/prospect/${prospect.id}`}");
  assert.ok(page > 0, "Prospect page link present");
  assert.ok(workspace > page, "it sits just before Open Workspace");
  assert.ok(workspace - page < 800, "in the same header group");
  assert.match(src.slice(page, workspace), /Prospect page/);
  assert.match(src, /Open Workspace/);
});
