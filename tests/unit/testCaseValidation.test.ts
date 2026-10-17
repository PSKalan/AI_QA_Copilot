import assert from "node:assert/strict";
import { test } from "node:test";

import { validateTestCase, validateTestCases, type ValidationIssue } from "../../src/validation/index.ts";

function baseCase(): Record<string, unknown> {
  return {
    id: "TC-1",
    title: "Login with valid credentials",
    description: "A registered user can sign in.",
    preconditions: ["A registered user exists."],
    steps: [{ action: "Open the login page" }, { action: "Submit valid credentials" }],
    expectedResult: "The user is redirected to the dashboard.",
    priority: "high",
    tags: ["auth"],
    source: { provenance: "curated", verification: { status: "unverified" } },
    createdAt: "2026-01-01T12:00:00Z",
  };
}

function validCase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...baseCase(), ...overrides };
}

function issueAt(issues: ValidationIssue[], path: string): ValidationIssue | undefined {
  return issues.find((issue) => issue.path === path);
}

test("a fully valid curated case passes and returns a typed value", () => {
  const result = validateTestCase(validCase());

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.id, "TC-1");
    assert.equal(result.value.priority, "high");
    assert.equal(result.value.source.provenance, "curated");
  }
});

test("a minimal case normalizes preconditions and tags to []", () => {
  const input = validCase();
  delete input["preconditions"];
  delete input["tags"];

  const result = validateTestCase(input);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.preconditions, []);
    assert.deepEqual(result.value.tags, []);
  }
});

test("generated + unverified is valid and never upgraded", () => {
  const result = validateTestCase(
    validCase({
      source: {
        provenance: "generated",
        verification: { status: "unverified" },
        generator: "llama3",
      },
    }),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.source.provenance, "generated");
    assert.equal(result.value.source.verification.status, "unverified");
    assert.equal(result.value.source.generator, "llama3");
  }
});

test("generated + execution-verified with evidence is valid", () => {
  const result = validateTestCase(
    validCase({
      source: {
        provenance: "generated",
        verification: {
          status: "execution-verified",
          evidence: { runAt: "2026-01-02T08:30:00Z", tool: "playwright", reference: "run-42" },
        },
        generator: "llama3",
      },
    }),
  );

  assert.equal(result.ok, true);
});

test("step order is preserved", () => {
  const result = validateTestCase(
    validCase({ steps: [{ action: "first" }, { action: "second" }, { action: "third" }] }),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(
      result.value.steps.map((step) => step.action),
      ["first", "second", "third"],
    );
  }
});

const REQUIRED_FIELDS = [
  "id",
  "title",
  "description",
  "steps",
  "expectedResult",
  "priority",
  "source",
  "createdAt",
] as const;

for (const field of REQUIRED_FIELDS) {
  test(`missing ${field} is reported at its path`, () => {
    const input = validCase();
    delete input[field];

    const result = validateTestCase(input);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.issues.some((issue) => issue.path === field || issue.path.startsWith(`${field}.`)),
        `expected an issue for "${field}"`,
      );
    }
  });
}

test("empty title yields an empty issue", () => {
  const result = validateTestCase(validCase({ title: "   " }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "title")?.code, "empty");
  }
});

test("invalid priority yields invalid_value listing the allowed values", () => {
  const result = validateTestCase(validCase({ priority: "urgent" }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    const issue = issueAt(result.issues, "priority");
    assert.equal(issue?.code, "invalid_value");
    assert.match(issue?.message ?? "", /low/);
    assert.match(issue?.message ?? "", /critical/);
  }
});

test("empty steps array is rejected", () => {
  const result = validateTestCase(validCase({ steps: [] }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "steps")?.code, "invalid_value");
  }
});

test("non-array steps is invalid_type", () => {
  const result = validateTestCase(validCase({ steps: "do the thing" }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "steps")?.code, "invalid_type");
  }
});

test("a step with an empty action is rejected at its path", () => {
  const result = validateTestCase(validCase({ steps: [{ action: "ok" }, { action: "   " }] }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "steps[1].action")?.code, "empty");
  }
});

const INVALID_TIMESTAMPS = [
  "not-a-date",
  "2026-13-45T00:00:00Z",
  "2026-02-30T00:00:00Z",
  "2026-04-31T00:00:00Z",
  "2027-02-29T00:00:00Z",
  "2026-01-01T24:00:00Z",
  "2026-01-01T12:60:00Z",
  "2026-01-01T12:00:60Z",
  "2026-01-01T12:00:00+25:00",
] as const;

for (const timestamp of INVALID_TIMESTAMPS) {
  test(`createdAt "${timestamp}" is malformed_timestamp`, () => {
    const result = validateTestCase(validCase({ createdAt: timestamp }));

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(issueAt(result.issues, "createdAt")?.code, "malformed_timestamp");
    }
  });
}

test("a real leap day is a valid timestamp", () => {
  const result = validateTestCase(validCase({ createdAt: "2028-02-29T00:00:00Z" }));

  assert.equal(result.ok, true);
});

test("a plain ISO timestamp is valid", () => {
  const result = validateTestCase(validCase({ createdAt: "2026-01-01T12:00:00Z" }));

  assert.equal(result.ok, true);
});

test("malformed evidence.runAt is reported at its path", () => {
  const result = validateTestCase(
    validCase({
      source: {
        provenance: "generated",
        verification: {
          status: "execution-verified",
          evidence: { runAt: "2026-02-30T00:00:00Z", tool: "playwright" },
        },
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      issueAt(result.issues, "source.verification.evidence.runAt")?.code,
      "malformed_timestamp",
    );
  }
});

test("cases sharing an id are all rejected with duplicate_id issues", () => {
  const result = validateTestCases([
    validCase({ id: "dup" }),
    validCase({ id: "dup", title: "Second" }),
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.value.length, 0);
  const duplicates = result.issues.filter((issue) => issue.code === "duplicate_id");
  assert.equal(duplicates.length, 2);
  assert.deepEqual(duplicates.map((issue) => issue.path).sort(), ["[0].id", "[1].id"]);
});

test("three cases sharing one id produce three duplicate_id issues", () => {
  const result = validateTestCases([
    validCase({ id: "dup" }),
    validCase({ id: "dup" }),
    validCase({ id: "dup" }),
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.issues.filter((issue) => issue.code === "duplicate_id").length, 3);
  assert.equal(result.value.length, 0);
});

test("a valid case is still excluded when its id collides", () => {
  const result = validateTestCases([validCase({ id: "dup" }), validCase({ id: "dup" })]);

  assert.ok(!result.value.some((testCase) => testCase.id === "dup"));
});

test("a distinct valid case survives alongside a duplicate collision", () => {
  const result = validateTestCases([
    validCase({ id: "dup" }),
    validCase({ id: "dup" }),
    validCase({ id: "unique" }),
  ]);

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.value.map((testCase) => testCase.id),
    ["unique"],
  );
});

test("distinct ids produce no duplicate_id issues and preserve order", () => {
  const result = validateTestCases([validCase({ id: "a" }), validCase({ id: "b" })]);

  assert.equal(result.ok, true);
  assert.equal(result.issues.filter((issue) => issue.code === "duplicate_id").length, 0);
  assert.deepEqual(
    result.value.map((testCase) => testCase.id),
    ["a", "b"],
  );
});

test("a non-array collection is rejected", () => {
  const result = validateTestCases("not-an-array");

  assert.equal(result.ok, false);
  assert.equal(result.value.length, 0);
  assert.equal(issueAt(result.issues, "")?.code, "invalid_type");
});

test("missing source.provenance is reported", () => {
  const result = validateTestCase(
    validCase({ source: { verification: { status: "unverified" } } }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "source.provenance")?.code, "missing");
  }
});

test("invalid provenance is invalid_value", () => {
  const result = validateTestCase(
    validCase({ source: { provenance: "auto", verification: { status: "unverified" } } }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "source.provenance")?.code, "invalid_value");
  }
});

test("execution-verified without evidence is inconsistent_source", () => {
  const result = validateTestCase(
    validCase({ source: { provenance: "generated", verification: { status: "execution-verified" } } }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      issueAt(result.issues, "source.verification.evidence")?.code,
      "inconsistent_source",
    );
  }
});

test("empty evidence.tool is rejected", () => {
  const result = validateTestCase(
    validCase({
      source: {
        provenance: "generated",
        verification: {
          status: "execution-verified",
          evidence: { runAt: "2026-01-02T08:30:00Z", tool: "   " },
        },
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "source.verification.evidence.tool")?.code, "empty");
  }
});

test("non-string evidence.tool is invalid_type", () => {
  const result = validateTestCase(
    validCase({
      source: {
        provenance: "generated",
        verification: {
          status: "execution-verified",
          evidence: { runAt: "2026-01-02T08:30:00Z", tool: 7 },
        },
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "source.verification.evidence.tool")?.code, "invalid_type");
  }
});

test("curated with a generator is inconsistent_source", () => {
  const result = validateTestCase(
    validCase({
      source: {
        provenance: "curated",
        verification: { status: "unverified" },
        generator: "llama3",
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "source.generator")?.code, "inconsistent_source");
  }
});

test("an empty generator is rejected", () => {
  const result = validateTestCase(
    validCase({
      source: {
        provenance: "generated",
        verification: { status: "unverified" },
        generator: "   ",
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "source.generator")?.code, "empty");
  }
});

test("a non-string generator is invalid_type", () => {
  const result = validateTestCase(
    validCase({
      source: {
        provenance: "generated",
        verification: { status: "unverified" },
        generator: 42,
      },
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(issueAt(result.issues, "source.generator")?.code, "invalid_type");
  }
});

test("wrong field types are reported as invalid_type", () => {
  const cases: Record<string, unknown>[] = [
    validCase({ id: 5 }),
    validCase({ title: 5 }),
    validCase({ createdAt: 5 }),
    validCase({ tags: "auth" }),
    validCase({ preconditions: "none" }),
    validCase({ steps: [42] }),
    validCase({ source: "curated" }),
  ];

  for (const input of cases) {
    const result = validateTestCase(input);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.some((issue) => issue.code === "invalid_type"));
    }
  }
});

test("a non-object test case is invalid_type", () => {
  const result = validateTestCase("not-an-object");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0]?.code, "invalid_type");
  }
});
