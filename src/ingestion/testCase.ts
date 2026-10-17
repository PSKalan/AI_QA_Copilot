export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TestPriority = (typeof PRIORITIES)[number];

export type Provenance = "curated" | "generated";

export type VerificationStatus = "unverified" | "execution-verified";

export interface ExecutionEvidence {
  runAt: string;
  tool: string;
  reference?: string;
}

export type Verification =
  | { status: "unverified" }
  | { status: "execution-verified"; evidence: ExecutionEvidence };

export interface TestCaseSource {
  provenance: Provenance;
  verification: Verification;
  generator?: string;
}

export interface TestStep {
  action: string;
  expected?: string;
}

export interface TestCase {
  id: string;
  title: string;
  description: string;
  preconditions: string[];
  steps: TestStep[];
  expectedResult: string;
  priority: TestPriority;
  tags: string[];
  source: TestCaseSource;
  createdAt: string;
}
