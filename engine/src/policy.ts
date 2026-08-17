import { hashCanonical, normalizeAddress } from "./canonical";
import type {
  Address,
  AnalysisInput,
  DecodedEffect,
  EvidenceItem,
  IntentSpec,
  PolicyOptions,
  ProposedRequest,
  RuleResult,
} from "./types";
import { Verdict } from "./types";
import { isUnlimited } from "./decoder";

const ZERO = "0";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function sameAddress(left: Address | undefined, right: Address | undefined): boolean {
  if (left === undefined || right === undefined) return false;
  return normalizeAddress(left) === normalizeAddress(right);
}

function safeBigInt(value: string | undefined): bigint | undefined {
  if (value === undefined || !/^(0|[1-9][0-9]*)$/.test(value)) return undefined;
  return BigInt(value);
}

function isAllowedAddress(
  actual: Address | undefined,
  constraint: { exact?: Address; allowlist?: Address[] } | undefined,
): boolean {
  if (constraint === undefined) return true;
  if (constraint.exact !== undefined) return sameAddress(actual, constraint.exact);
  if (constraint.allowlist !== undefined) {
    return actual !== undefined && constraint.allowlist.some((allowed) => sameAddress(actual, allowed));
  }
  return actual !== undefined;
}

function actionMatches(intentAction: IntentSpec["action"], effect: DecodedEffect): boolean {
  switch (intentAction) {
    case "TRANSFER":
      return effect.kind === "ERC20_TRANSFER" || effect.kind === "NATIVE_TRANSFER";
    case "APPROVE":
      return effect.kind === "ERC20_APPROVE";
    case "PERMIT":
      return effect.kind === "ERC2612_PERMIT";
    case "SWAP":
      return effect.kind === "KNOWN_SWAP";
    case "CLAIM":
      return effect.kind === "KNOWN_SWAP" || effect.kind === "ERC20_TRANSFER";
    case "BRIDGE":
      return effect.kind === "KNOWN_SWAP";
    case "UNKNOWN":
      return true;
    default:
      return false;
  }
}

function addRule(
  rules: RuleResult[],
  evidence: EvidenceItem[],
  input: {
    code: string;
    severity: RuleResult["severity"];
    passed: boolean;
    message: string;
    kind?: EvidenceItem["kind"];
    source?: string;
  },
): void {
  const evidenceId = `ev-${String(evidence.length + 1).padStart(3, "0")}`;
  const inputHash = hashCanonical({ code: input.code, message: input.message });
  const outputHash = hashCanonical({ passed: input.passed, severity: input.severity });
  evidence.push({
    id: evidenceId,
    kind: input.kind ?? "POLICY_COMPARISON",
    source: input.source ?? "intentguard-policy-engine-1.0.0",
    inputHash,
    outputHash,
    status: input.passed ? "PASS" : input.severity === "WARNING" ? "WARNING" : "FAIL",
    redactedSummary: input.message,
  });
  rules.push({
    code: input.code,
    severity: input.severity,
    passed: input.passed,
    message: input.message,
    evidenceIds: [evidenceId],
  });
}

function addDecodeEvidence(
  evidence: EvidenceItem[],
  request: ProposedRequest,
  effect: DecodedEffect,
): void {
  const inputHash = hashCanonical(request);
  const outputHash = hashCanonical(effect);
  evidence.push({
    id: `ev-${String(evidence.length + 1).padStart(3, "0")}`,
    kind: effect.kind === "ERC2612_PERMIT" ? "EIP712_DECODE" : "CALLDATA_DECODE",
    source: effect.abiSource,
    inputHash,
    outputHash,
    status: effect.decodeConfidence === "EXACT" ? "PASS" : "UNAVAILABLE",
    redactedSummary:
      effect.decodeConfidence === "EXACT"
        ? `Decoded ${effect.kind} with ${effect.abiSource}.`
        : "Request selector or typed data could not be decoded exactly.",
  });
}

function addChainEvidence(evidence: EvidenceItem[], request: ProposedRequest, intent: IntentSpec): void {
  evidence.push({
    id: `ev-${String(evidence.length + 1).padStart(3, "0")}`,
    kind: "CHAIN_ID",
    source: "request-and-intent-schema",
    inputHash: hashCanonical({ requestChainId: request.chainId, intentChainId: intent.chainId }),
    outputHash: hashCanonical({ chainMatches: request.chainId === intent.chainId }),
    status: request.chainId === intent.chainId ? "PASS" : "FAIL",
    redactedSummary: `Request chain ${request.chainId}; declared chain ${intent.chainId}.`,
  });
}

export type PolicyEvaluation = {
  verdict: Verdict;
  primaryReasonCode?: string;
  rules: RuleResult[];
  evidence: EvidenceItem[];
  explanation: string;
};

export function evaluatePolicy(
  input: AnalysisInput,
  effect: DecodedEffect,
  options: PolicyOptions,
): PolicyEvaluation {
  const { intent, request } = input;
  const rules: RuleResult[] = [];
  const evidence: EvidenceItem[] = [];
  addChainEvidence(evidence, request, intent);
  addDecodeEvidence(evidence, request, effect);

  addRule(rules, evidence, {
    code: "IG-CHAIN-001",
    severity: "HARD_BLOCK",
    passed: request.chainId === intent.chainId,
    message:
      request.chainId === intent.chainId
        ? "The proposed request uses the declared chain."
        : `The request uses chain ${request.chainId}, but the intent declares chain ${intent.chainId}.`,
  });

  addRule(rules, evidence, {
    code: "IG-ACTION-001",
    severity: effect.decodeConfidence === "EXACT" ? "HARD_BLOCK" : "UNCERTAINTY",
    passed: actionMatches(intent.action, effect),
    message: actionMatches(intent.action, effect)
      ? `Decoded effect ${effect.kind} is compatible with action ${intent.action}.`
      : `Decoded effect ${effect.kind} does not match declared action ${intent.action}.`,
  });

  const decodeIsExact = effect.decodeConfidence === "EXACT";
  if (!decodeIsExact && !intent.allowUnknownSelectors) {
    addRule(rules, evidence, {
      code: "IG-SELECTOR-001",
      severity: "UNCERTAINTY",
      passed: false,
      message: "The request could not be decoded exactly; IntentGuard will not guess its effect.",
    });
  } else {
    addRule(rules, evidence, {
      code: "IG-SELECTOR-001",
      severity: "UNCERTAINTY",
      passed: true,
      message: "The request is decoded sufficiently for the configured policy.",
    });
  }

  if (intent.protocol !== undefined) {
    const targetKnown = effect.target !== undefined;
    const protocolMatches = targetKnown && isAllowedAddress(effect.target, intent.protocol);
    addRule(rules, evidence, {
      code: "IG-TARGET-001",
      severity: targetKnown ? "HARD_BLOCK" : "UNCERTAINTY",
      passed: protocolMatches,
      message: protocolMatches
        ? "The target matches the declared protocol constraint."
        : targetKnown
          ? "The target does not match the declared protocol constraint."
          : "The target could not be decoded for protocol comparison.",
    });
  }

  if (intent.recipient !== undefined) {
    const recipientKnown = effect.recipient !== undefined;
    const recipientMatches = recipientKnown && isAllowedAddress(effect.recipient, intent.recipient);
    addRule(rules, evidence, {
      code: "IG-RECIPIENT-001",
      severity: recipientKnown ? "HARD_BLOCK" : "UNCERTAINTY",
      passed: recipientMatches,
      message: recipientMatches
        ? "The recipient matches the declared recipient constraint."
        : recipientKnown
          ? "The recipient does not match the declared recipient constraint."
          : "The recipient could not be decoded for recipient comparison.",
    });
  }

  const spenderRelevant = effect.kind === "ERC20_APPROVE" || effect.kind === "ERC2612_PERMIT";
  if (intent.spender !== undefined && spenderRelevant) {
    const spenderKnown = effect.spender !== undefined;
    const spenderMatches = spenderKnown && isAllowedAddress(effect.spender, intent.spender);
    addRule(rules, evidence, {
      code: "IG-APPROVE-002",
      severity: spenderKnown ? "HARD_BLOCK" : "UNCERTAINTY",
      passed: spenderMatches,
      message: spenderMatches
        ? "The spender matches the declared spender constraint."
        : spenderKnown
          ? "The spender is not allowed by the declared spender constraint."
          : "The spender could not be decoded for comparison.",
    });
  }

  if (
    intent.asset?.address !== undefined &&
    intent.asset.address !== "NATIVE" &&
    effect.token !== undefined
  ) {
    const assetMatches = sameAddress(intent.asset.address, effect.token);
    addRule(rules, evidence, {
      code: "IG-ASSET-001",
      severity: "HARD_BLOCK",
      passed: assetMatches,
      message: assetMatches
        ? "The token matches the declared asset."
        : "The token does not match the declared asset.",
    });
  }

  const nativeValue = safeBigInt(effect.nativeValueWei ?? ZERO) ?? 0n;
  addRule(rules, evidence, {
    code: "IG-NATIVE-001",
    severity: "HARD_BLOCK",
    passed: intent.allowNativeValue || nativeValue === 0n,
    message:
      intent.allowNativeValue || nativeValue === 0n
        ? "The request does not violate the native-value policy."
        : "The request carries native value while native value is disallowed.",
  });

  if (intent.spendCap?.maxRaw !== undefined && effect.amountRaw !== undefined) {
    const actual = safeBigInt(effect.amountRaw);
    const cap = safeBigInt(intent.spendCap.maxRaw);
    const withinCap = actual !== undefined && cap !== undefined && actual <= cap;
    addRule(rules, evidence, {
      code: "IG-AMOUNT-001",
      severity: "HARD_BLOCK",
      passed: withinCap,
      message: withinCap
        ? `Spend ${effect.amountRaw} is within cap ${intent.spendCap.maxRaw}.`
        : `Spend ${effect.amountRaw} exceeds cap ${intent.spendCap.maxRaw}.`,
    });
  } else if (intent.spendCap?.maxRaw !== undefined) {
    addRule(rules, evidence, {
      code: "IG-AMOUNT-001",
      severity: "UNCERTAINTY",
      passed: false,
      message: "A spend cap was declared, but the request amount could not be decoded.",
    });
  }

  if (effect.kind === "ERC20_APPROVE") {
    const approvalAmount = effect.amountRaw;
    const unlimited = approvalAmount !== undefined && isUnlimited(approvalAmount);
    const exactAllowed = intent.approvalPolicy !== "EXACT_ONLY" || !unlimited;
    addRule(rules, evidence, {
      code: "IG-APPROVE-001",
      severity: "HARD_BLOCK",
      passed: exactAllowed,
      message: exactAllowed
        ? "The approval is compatible with the configured approval policy."
        : "The request grants an unlimited allowance while exact approval is required.",
    });

    if (intent.approvalPolicy === "BOUNDED" && intent.spendCap?.maxRaw !== undefined) {
      const amount = safeBigInt(approvalAmount);
      const cap = safeBigInt(intent.spendCap.maxRaw);
      const bounded = amount !== undefined && cap !== undefined && amount <= cap;
      addRule(rules, evidence, {
        code: "IG-APPROVE-003",
        severity: "HARD_BLOCK",
        passed: bounded,
        message: bounded
          ? "The approval is within the declared allowance bound."
          : "The approval exceeds the declared allowance bound.",
      });
    }
  }

  if (effect.kind === "ERC2612_PERMIT") {
    const permitAllowed = intent.permitPolicy !== "DISALLOW";
    addRule(rules, evidence, {
      code: "IG-PERMIT-001",
      severity: "HARD_BLOCK",
      passed: permitAllowed,
      message: permitAllowed
        ? "Permit signatures are allowed by the declared policy."
        : "The request contains a permit signature while permits are disallowed.",
    });

    if (intent.permitPolicy === "BOUNDED" && intent.spendCap?.maxRaw !== undefined) {
      const value = safeBigInt(effect.amountRaw);
      const cap = safeBigInt(intent.spendCap.maxRaw);
      const bounded = value !== undefined && cap !== undefined && value <= cap;
      addRule(rules, evidence, {
        code: "IG-PERMIT-002",
        severity: "HARD_BLOCK",
        passed: bounded,
        message: bounded
          ? "The permit value is within the declared cap."
          : "The permit value exceeds the declared cap.",
      });
    }

    if (effect.deadline !== undefined && intent.permitMaxDeadlineSeconds !== undefined) {
      const now = options.now ?? Math.floor(Date.now() / 1000);
      const deadlineAllowed = effect.deadline >= now && effect.deadline <= now + intent.permitMaxDeadlineSeconds;
      addRule(rules, evidence, {
        code: "IG-PERMIT-003",
        severity: "HARD_BLOCK",
        passed: deadlineAllowed,
        message: deadlineAllowed
          ? "The permit deadline is within the declared time window."
          : "The permit deadline is expired or longer than the declared time window.",
      });
    } else {
      addRule(rules, evidence, {
        code: "IG-PERMIT-003",
        severity: "UNCERTAINTY",
        passed: effect.deadline !== undefined,
        message: effect.deadline !== undefined
          ? "Permit deadline was decoded."
          : "Permit deadline could not be verified.",
      });
    }

    const domainChain = effect.typedDataDomain?.chainId;
    if (domainChain !== undefined) {
      const domainChainNumber = typeof domainChain === "number" ? domainChain : Number(String(domainChain));
      const domainMatches = Number.isSafeInteger(domainChainNumber) && domainChainNumber === intent.chainId;
      addRule(rules, evidence, {
        code: "IG-PERMIT-004",
        severity: "HARD_BLOCK",
        passed: domainMatches,
        message: domainMatches
          ? "The typed-data domain matches the declared chain."
          : "The typed-data domain chain does not match the declared chain.",
      });
    } else {
      addRule(rules, evidence, {
        code: "IG-PERMIT-004",
        severity: "UNCERTAINTY",
        passed: false,
        message: "The typed-data domain chain is unavailable.",
      });
    }
  }

  if (intent.validAfter !== undefined) {
    const now = options.now ?? Math.floor(Date.now() / 1000);
    addRule(rules, evidence, {
      code: "IG-INTENT-001",
      severity: "HARD_BLOCK",
      passed: now >= intent.validAfter,
      message: now >= intent.validAfter
        ? "The intent is active."
        : "The intent is not active yet.",
    });
  }

  if (intent.validUntil !== undefined) {
    const now = options.now ?? Math.floor(Date.now() / 1000);
    addRule(rules, evidence, {
      code: "IG-INTENT-002",
      severity: "HARD_BLOCK",
      passed: now <= intent.validUntil,
      message: now <= intent.validUntil
        ? "The intent has not expired."
        : "The intent has expired.",
    });
  }

  const hardFailures = rules.filter((rule) => !rule.passed && rule.severity === "HARD_BLOCK");
  const uncertainties = rules.filter((rule) => !rule.passed && rule.severity === "UNCERTAINTY");
  const verdict = hardFailures.length > 0
    ? Verdict.MISMATCH
    : uncertainties.length > 0
      ? Verdict.CANNOT_VERIFY
      : Verdict.MATCH;
  const primaryReasonCode = hardFailures[0]?.code ?? uncertainties[0]?.code;

  const explanation = buildExplanation(verdict, primaryReasonCode, effect, intent);
  return { verdict, primaryReasonCode, rules, evidence, explanation };
}

function buildExplanation(
  verdict: Verdict,
  primaryReasonCode: string | undefined,
  effect: DecodedEffect,
  intent: IntentSpec,
): string {
  if (verdict === Verdict.MATCH) {
    return `The decoded ${effect.kind} matches the declared ${intent.action} intent under the configured policy. Review the evidence before signing.`;
  }
  if (verdict === Verdict.MISMATCH) {
    return `IntentGuard blocked this request because ${primaryReasonCode ?? "a declared policy rule"} was violated. Do not sign until the request is corrected.`;
  }
  return `IntentGuard could not verify this request completely because ${primaryReasonCode ?? "critical evidence"} is unavailable. Do not sign until the effect is decoded and verified.`;
}

export function hasHardFailure(rules: RuleResult[]): boolean {
  return rules.some((rule) => !rule.passed && rule.severity === "HARD_BLOCK");
}

export function hasUncertainty(rules: RuleResult[]): boolean {
  return rules.some((rule) => !rule.passed && rule.severity === "UNCERTAINTY");
}

export const ZERO_ADDRESS_CONSTANT = ZERO_ADDRESS;
