import { analyze } from "./receipt";
import { Verdict } from "./types";
import type {
  AnalysisInput,
  AnalysisResult,
  IntentSpec,
  PolicyOptions,
  ProposedRequest,
  RuleResult,
} from "./types";

export interface GuardrailCheckResult {
  isSafe: boolean;
  verdict: Verdict;
  primaryReasonCode?: string;
  explanation: string;
  analysis: AnalysisResult;
  failedRules: RuleResult[];
}

/**
 * Verify a proposed agent transaction against a declared intent constraint.
 * Deterministic verdict authority (LLMs may interpret intent; deterministic rules enforce verdicts).
 *
 * @example
 * ```ts
 * const result = verifyAgentAction({
 *   intent: {
 *     schemaVersion: 1,
 *     chainId: 8453,
 *     action: "TRANSFER",
 *     spendCap: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", maxRaw: "10000000" } // 10 USDC
 *   },
 *   request: {
 *     schemaVersion: 1,
 *     chainId: 8453,
 *     to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
 *     data: "0xa9059cbb..." // transfer 10 USDC
 *   }
 * });
 *
 * if (!result.isSafe) {
 *   throw new Error(`Blocked by IntentGuard: ${result.explanation}`);
 * }
 * ```
 */
export function verifyAgentAction(
  input: AnalysisInput,
  options?: Partial<PolicyOptions>,
): GuardrailCheckResult {
  const policyOpts: PolicyOptions = {
    chainId: options?.chainId ?? input.intent.chainId ?? input.request.chainId ?? 8453,
    now: options?.now,
    blockNumber: options?.blockNumber,
    blockHash: options?.blockHash,
  };

  const analysis = analyze(input, policyOpts);
  const isSafe = analysis.verdict === Verdict.MATCH;
  const failedRules = analysis.rules.filter((r) => !r.passed);

  return {
    isSafe,
    verdict: analysis.verdict,
    primaryReasonCode: analysis.primaryReasonCode,
    explanation: analysis.explanation,
    analysis,
    failedRules,
  };
}

/**
 * Creates a reusable guardrail middleware function for an AI agent runner.
 */
export function createAgentGuardrail(
  intent: IntentSpec,
  options?: Partial<PolicyOptions>,
) {
  return function guard(request: ProposedRequest): GuardrailCheckResult {
    return verifyAgentAction({ intent, request }, options);
  };
}
