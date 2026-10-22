/**
 * Duplicate project slugs must come back as a 409 the admin form can show.
 *
 * Production incident this guards (dandana-cabaret, 2026-10-22):
 *   12:12:12  POST /api/admin/projects  201  project created
 *   12:13:09  POST /api/admin/projects  500  P2002 Unique constraint failed on (slug)
 *   12:15:28  POST /api/admin/projects  500  same
 * The form could only say "Something went wrong."
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findSlugConflict, isUniqueSlugViolation, slugConflict } from "../src/lib/project-slug";
import { CLIENT_SLUGS } from "../src/lib/homepage-clients";

/** Shape of the error Prisma 7 + the Neon adapter actually threw in production. */
function neonP2002(fields: string[] | undefined, modelName = "Project") {
  return {
    name: "PrismaClientKnownRequestError",
    code: "P2002",
    message: "Invalid `prisma.project.create()` invocation: Unique constraint failed",
    meta: {
      modelName,
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: { kind: "UniqueConstraintViolation", constraint: fields ? { fields } : undefined },
      },
    },
  };
}

test("slug owned by another project is a 409 with a clear message", async () => {
  const conflict = await findSlugConflict("dandana-cabaret", null, async () => "cmvjfyp21000008jsr6n1kzzc");
  assert.equal(conflict?.status, 409);
  assert.match(conflict!.error, /"dandana-cabaret" already exists/);
});

test("free slug is not a conflict", async () => {
  assert.equal(await findSlugConflict("new-project", null, async () => null), null);
});

test("updating a project without changing its slug is not a conflict", async () => {
  assert.equal(await findSlugConflict("tannour", "id-1", async () => "id-1"), null);
});

test("renaming a project onto another project's slug is a conflict", async () => {
  assert.equal((await findSlugConflict("tannour", "id-2", async () => "id-1"))?.status, 409);
});

test("P2002 on the slug column is recognised (Neon adapter fields)", () => {
  assert.equal(isUniqueSlugViolation(neonP2002(["slug"])), true);
});

test("P2002 with meta.target or a named index is recognised", () => {
  assert.equal(isUniqueSlugViolation({ code: "P2002", meta: { target: ["slug"] } }), true);
  assert.equal(isUniqueSlugViolation({ code: "P2002", meta: { target: "projects_slug_key" } }), true);
});

test("P2002 on translations (project_id, locale) is not a slug clash", () => {
  assert.equal(isUniqueSlugViolation(neonP2002(["project_id", "locale"])), false);
  assert.equal(isUniqueSlugViolation({ code: "P2002", meta: { target: "project_translations_project_id_locale_key" } }), false);
});

test("P2002 without column info falls back to the model name", () => {
  assert.equal(isUniqueSlugViolation(neonP2002(undefined, "Project")), true);
  assert.equal(isUniqueSlugViolation(neonP2002(undefined, "ProjectTranslation")), false);
});

test("other errors are not slug clashes", () => {
  assert.equal(isUniqueSlugViolation(new Error("connection reset")), false);
  assert.equal(isUniqueSlugViolation({ code: "P2025" }), false);
  assert.equal(isUniqueSlugViolation(null), false);
  assert.equal(isUniqueSlugViolation("P2002"), false);
});

test("slugConflict message names the slug", () => {
  assert.deepEqual(slugConflict("x"), {
    status: 409,
    error: 'A project with the slug "x" already exists. Edit that project or choose a different slug.',
  });
});

test("Dandana Cabaret is classified as client work, by its real slug", () => {
  for (const slug of ["dandana-cabaret", "terrene", "aylani-parfums", "luxury-copro"]) {
    assert.equal(CLIENT_SLUGS.has(slug), true, slug);
  }
  assert.equal(CLIENT_SLUGS.has("dandana"), false, "stale slug that matched no project");
  for (const concept of ["goudoukh", "hammam-nour", "tannour", "victory-path", "asrar-lalla"]) {
    assert.equal(CLIENT_SLUGS.has(concept), false, concept);
  }
});
