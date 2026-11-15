import { test } from "node:test";
import assert from "node:assert/strict";
import { isNeonUrl } from "../src/lib/prisma";

test("Neon hosts use the Neon driver, any other Postgres uses pg", () => {
  assert.equal(isNeonUrl("postgresql://u:p@ep-cool-123.eu-central-1.aws.neon.tech/db?sslmode=require"), true);
  assert.equal(isNeonUrl("postgresql://u:p@ep-cool-123-pooler.eu-central-1.aws.neon.tech/db"), true);
  assert.equal(isNeonUrl("postgresql://u:p@localhost:5432/ibda3"), false);
  assert.equal(isNeonUrl("postgresql://u:p@db:5432/ibda3"), false);
  assert.equal(isNeonUrl("not a url"), false);
});
