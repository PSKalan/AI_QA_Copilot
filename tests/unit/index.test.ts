import assert from "node:assert/strict";
import { test } from "node:test";

import { greet, PROJECT_NAME } from "../../src/index.ts";

test("PROJECT_NAME identifies the project", () => {
  assert.equal(PROJECT_NAME, "ai-qa-copilot");
});

test("greet returns a greeting for the given name", () => {
  assert.equal(greet("QA"), "Hello, QA!");
});
