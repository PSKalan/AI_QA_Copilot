import {
  PRIORITIES,
  type ExecutionEvidence,
  type Provenance,
  type TestCase,
  type TestCaseSource,
  type TestPriority,
  type TestStep,
  type Verification,
} from "../ingestion/index.ts";

export type ValidationCode =
  | "invalid_type"
  | "missing"
  | "empty"
  | "invalid_value"
  | "malformed_timestamp"
  | "duplicate_id"
  | "inconsistent_source";

export interface ValidationIssue {
  path: string;
  code: ValidationCode;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: TestCase }
  | { ok: false; issues: ValidationIssue[] };

export interface CollectionValidationResult {
  ok: boolean;
  value: TestCase[];
  issues: ValidationIssue[];
}

const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Calendar-aware ISO-8601 check: range-checks every component (including leap
// years and timezone offsets) instead of trusting a regex plus Date.parse().
export function isValidIsoDateTime(value: string): boolean {
  const match = ISO_DATETIME_RE.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = match[8]!;

  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return false;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  if (offset !== "Z") {
    const offsetHours = Number(offset.slice(1, 3));
    const offsetMinutes = Number(offset.slice(4, 6));
    if (offsetHours > 23 || offsetMinutes > 59) {
      return false;
    }
  }

  return !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readId(
  input: Record<string, unknown>,
  issues: ValidationIssue[],
): string | undefined {
  const value = input["id"];
  if (value === undefined) {
    issues.push({ path: "id", code: "missing", message: '"id" is required.' });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({ path: "id", code: "invalid_type", message: '"id" must be a string.' });
    return undefined;
  }
  if (value.trim() === "") {
    issues.push({ path: "id", code: "empty", message: '"id" must not be empty.' });
    return undefined;
  }
  if (/\s/.test(value)) {
    issues.push({
      path: "id",
      code: "invalid_value",
      message: '"id" must not contain whitespace.',
    });
    return undefined;
  }
  return value;
}

function readRequiredString(
  input: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[],
): string | undefined {
  const value = input[field];
  if (value === undefined) {
    issues.push({ path: field, code: "missing", message: `"${field}" is required.` });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({ path: field, code: "invalid_type", message: `"${field}" must be a string.` });
    return undefined;
  }
  if (value.trim() === "") {
    issues.push({ path: field, code: "empty", message: `"${field}" must not be empty.` });
    return undefined;
  }
  return value.trim();
}

function readStringArray(
  input: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[],
): string[] | undefined {
  const value = input[field];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({
      path: field,
      code: "invalid_type",
      message: `"${field}" must be an array of strings.`,
    });
    return undefined;
  }
  const result: string[] = [];
  let ok = true;
  value.forEach((entry, index) => {
    if (typeof entry !== "string") {
      issues.push({
        path: `${field}[${index}]`,
        code: "invalid_type",
        message: `"${field}[${index}]" must be a string.`,
      });
      ok = false;
      return;
    }
    if (entry.trim() === "") {
      issues.push({
        path: `${field}[${index}]`,
        code: "empty",
        message: `"${field}[${index}]" must not be empty.`,
      });
      ok = false;
      return;
    }
    result.push(entry.trim());
  });
  return ok ? result : undefined;
}

function readTimestamp(
  input: Record<string, unknown>,
  field: string,
  issues: ValidationIssue[],
): string | undefined {
  const value = input[field];
  if (value === undefined) {
    issues.push({ path: field, code: "missing", message: `"${field}" is required.` });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({ path: field, code: "invalid_type", message: `"${field}" must be a string.` });
    return undefined;
  }
  if (!isValidIsoDateTime(value)) {
    issues.push({
      path: field,
      code: "malformed_timestamp",
      message: `"${field}" must be a valid ISO-8601 date-time.`,
    });
    return undefined;
  }
  return value;
}

function readPriority(
  input: Record<string, unknown>,
  issues: ValidationIssue[],
): TestPriority | undefined {
  const value = input["priority"];
  if (value === undefined) {
    issues.push({ path: "priority", code: "missing", message: '"priority" is required.' });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({ path: "priority", code: "invalid_type", message: '"priority" must be a string.' });
    return undefined;
  }
  if (!(PRIORITIES as readonly string[]).includes(value)) {
    issues.push({
      path: "priority",
      code: "invalid_value",
      message: `"priority" must be one of: ${PRIORITIES.join(", ")}.`,
    });
    return undefined;
  }
  return value as TestPriority;
}

function readSteps(
  input: Record<string, unknown>,
  issues: ValidationIssue[],
): TestStep[] | undefined {
  const value = input["steps"];
  if (value === undefined) {
    issues.push({ path: "steps", code: "missing", message: '"steps" is required.' });
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({ path: "steps", code: "invalid_type", message: '"steps" must be an array.' });
    return undefined;
  }
  if (value.length === 0) {
    issues.push({
      path: "steps",
      code: "invalid_value",
      message: '"steps" must contain at least one step.',
    });
    return undefined;
  }
  const steps: TestStep[] = [];
  let ok = true;
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      issues.push({
        path: `steps[${index}]`,
        code: "invalid_type",
        message: `"steps[${index}]" must be an object.`,
      });
      ok = false;
      return;
    }
    const action = entry["action"];
    if (action === undefined) {
      issues.push({
        path: `steps[${index}].action`,
        code: "missing",
        message: `"steps[${index}].action" is required.`,
      });
      ok = false;
      return;
    }
    if (typeof action !== "string") {
      issues.push({
        path: `steps[${index}].action`,
        code: "invalid_type",
        message: `"steps[${index}].action" must be a string.`,
      });
      ok = false;
      return;
    }
    if (action.trim() === "") {
      issues.push({
        path: `steps[${index}].action`,
        code: "empty",
        message: `"steps[${index}].action" must not be empty.`,
      });
      ok = false;
      return;
    }
    const step: TestStep = { action };
    const expected = entry["expected"];
    if (typeof expected === "string") {
      step.expected = expected;
    }
    steps.push(step);
  });
  return ok ? steps : undefined;
}

function readVerification(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): Verification | undefined {
  if (!isRecord(value)) {
    issues.push({
      path,
      code: value === undefined ? "missing" : "invalid_type",
      message: `"${path}" must be an object.`,
    });
    return undefined;
  }

  const status = value["status"];
  if (status === "unverified") {
    return { status: "unverified" };
  }
  if (status !== "execution-verified") {
    issues.push({
      path: `${path}.status`,
      code: status === undefined ? "missing" : "invalid_value",
      message: `"${path}.status" must be "unverified" or "execution-verified".`,
    });
    return undefined;
  }

  const evidenceRaw = value["evidence"];
  if (!isRecord(evidenceRaw)) {
    issues.push({
      path: `${path}.evidence`,
      code: "inconsistent_source",
      message: `"${path}.evidence" is required when status is "execution-verified".`,
    });
    return undefined;
  }

  let runAt: string | undefined;
  const runAtRaw = evidenceRaw["runAt"];
  if (runAtRaw === undefined) {
    issues.push({
      path: `${path}.evidence.runAt`,
      code: "missing",
      message: `"${path}.evidence.runAt" is required.`,
    });
  } else if (typeof runAtRaw !== "string") {
    issues.push({
      path: `${path}.evidence.runAt`,
      code: "invalid_type",
      message: `"${path}.evidence.runAt" must be a string.`,
    });
  } else if (!isValidIsoDateTime(runAtRaw)) {
    issues.push({
      path: `${path}.evidence.runAt`,
      code: "malformed_timestamp",
      message: `"${path}.evidence.runAt" must be a valid ISO-8601 date-time.`,
    });
  } else {
    runAt = runAtRaw;
  }

  let tool: string | undefined;
  const toolRaw = evidenceRaw["tool"];
  if (toolRaw === undefined) {
    issues.push({
      path: `${path}.evidence.tool`,
      code: "missing",
      message: `"${path}.evidence.tool" is required.`,
    });
  } else if (typeof toolRaw !== "string") {
    issues.push({
      path: `${path}.evidence.tool`,
      code: "invalid_type",
      message: `"${path}.evidence.tool" must be a string.`,
    });
  } else if (toolRaw.trim() === "") {
    issues.push({
      path: `${path}.evidence.tool`,
      code: "empty",
      message: `"${path}.evidence.tool" must not be empty.`,
    });
  } else {
    tool = toolRaw.trim();
  }

  let reference: string | undefined;
  const referenceRaw = evidenceRaw["reference"];
  if (referenceRaw !== undefined) {
    if (typeof referenceRaw !== "string") {
      issues.push({
        path: `${path}.evidence.reference`,
        code: "invalid_type",
        message: `"${path}.evidence.reference" must be a string.`,
      });
    } else if (referenceRaw.trim() === "") {
      issues.push({
        path: `${path}.evidence.reference`,
        code: "empty",
        message: `"${path}.evidence.reference" must not be empty.`,
      });
    } else {
      reference = referenceRaw.trim();
    }
  }

  if (runAt === undefined || tool === undefined) {
    return undefined;
  }

  const evidence: ExecutionEvidence = { runAt, tool };
  if (reference !== undefined) {
    evidence.reference = reference;
  }
  return { status: "execution-verified", evidence };
}

function readSource(value: unknown, issues: ValidationIssue[]): TestCaseSource | undefined {
  const path = "source";
  if (!isRecord(value)) {
    issues.push({
      path,
      code: value === undefined ? "missing" : "invalid_type",
      message: `"${path}" must be an object.`,
    });
    return undefined;
  }

  let ok = true;

  let provenance: Provenance | undefined;
  const provenanceRaw = value["provenance"];
  if (provenanceRaw === undefined) {
    issues.push({
      path: `${path}.provenance`,
      code: "missing",
      message: `"${path}.provenance" is required.`,
    });
    ok = false;
  } else if (provenanceRaw !== "curated" && provenanceRaw !== "generated") {
    issues.push({
      path: `${path}.provenance`,
      code: "invalid_value",
      message: `"${path}.provenance" must be "curated" or "generated".`,
    });
    ok = false;
  } else {
    provenance = provenanceRaw;
  }

  let generator: string | undefined;
  const generatorRaw = value["generator"];
  if (generatorRaw !== undefined) {
    if (typeof generatorRaw !== "string") {
      issues.push({
        path: `${path}.generator`,
        code: "invalid_type",
        message: `"${path}.generator" must be a string.`,
      });
      ok = false;
    } else if (generatorRaw.trim() === "") {
      issues.push({
        path: `${path}.generator`,
        code: "empty",
        message: `"${path}.generator" must not be empty.`,
      });
      ok = false;
    } else {
      generator = generatorRaw.trim();
      if (provenance !== undefined && provenance !== "generated") {
        issues.push({
          path: `${path}.generator`,
          code: "inconsistent_source",
          message: `"${path}.generator" is only allowed when provenance is "generated".`,
        });
        ok = false;
      }
    }
  }

  const verification = readVerification(value["verification"], `${path}.verification`, issues);
  if (verification === undefined) {
    ok = false;
  }

  if (!ok || provenance === undefined || verification === undefined) {
    return undefined;
  }

  const source: TestCaseSource = { provenance, verification };
  if (generator !== undefined) {
    source.generator = generator;
  }
  return source;
}

export function validateTestCase(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ path: "", code: "invalid_type", message: "Test case must be an object." }],
    };
  }

  const issues: ValidationIssue[] = [];

  const id = readId(input, issues);
  const title = readRequiredString(input, "title", issues);
  const description = readRequiredString(input, "description", issues);
  const preconditions = readStringArray(input, "preconditions", issues);
  const steps = readSteps(input, issues);
  const expectedResult = readRequiredString(input, "expectedResult", issues);
  const priority = readPriority(input, issues);
  const tags = readStringArray(input, "tags", issues);
  const source = readSource(input["source"], issues);
  const createdAt = readTimestamp(input, "createdAt", issues);

  if (
    issues.length > 0 ||
    id === undefined ||
    title === undefined ||
    description === undefined ||
    preconditions === undefined ||
    steps === undefined ||
    expectedResult === undefined ||
    priority === undefined ||
    tags === undefined ||
    source === undefined ||
    createdAt === undefined
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      id,
      title,
      description,
      preconditions,
      steps,
      expectedResult,
      priority,
      tags,
      source,
      createdAt,
    },
  };
}

// Duplicate-ID policy: any id shared by more than one input is a conflict, and
// every occurrence of a conflicting id is rejected (no first/last-wins survivor),
// even when the case is otherwise valid. Rejected cases are excluded from
// `value`; each occurrence contributes a `duplicate_id` issue at `[i].id`.
export function validateTestCases(input: unknown): CollectionValidationResult {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      value: [],
      issues: [
        { path: "", code: "invalid_type", message: "Expected an array of test cases." },
      ],
    };
  }

  const issues: ValidationIssue[] = [];
  const valid: { index: number; value: TestCase }[] = [];

  input.forEach((item, index) => {
    const result = validateTestCase(item);
    if (result.ok) {
      valid.push({ index, value: result.value });
      return;
    }
    for (const issue of result.issues) {
      issues.push({
        path: `[${index}]${issue.path === "" ? "" : `.${issue.path}`}`,
        code: issue.code,
        message: issue.message,
      });
    }
  });

  const counts = new Map<string, number>();
  for (const item of input) {
    if (isRecord(item)) {
      const idValue = item["id"];
      if (typeof idValue === "string") {
        counts.set(idValue, (counts.get(idValue) ?? 0) + 1);
      }
    }
  }

  const duplicatedIds = new Set<string>();
  for (const [idValue, count] of counts) {
    if (count > 1) {
      duplicatedIds.add(idValue);
    }
  }

  input.forEach((item, index) => {
    if (isRecord(item)) {
      const idValue = item["id"];
      if (typeof idValue === "string" && duplicatedIds.has(idValue)) {
        issues.push({
          path: `[${index}].id`,
          code: "duplicate_id",
          message: `Duplicate id "${idValue}" conflicts with another test case.`,
        });
      }
    }
  });

  const value = valid
    .filter((entry) => !duplicatedIds.has(entry.value.id))
    .map((entry) => entry.value);

  return { ok: issues.length === 0, value, issues };
}
