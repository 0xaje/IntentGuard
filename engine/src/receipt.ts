import { randomBytes } from "ethers";
import { hashCanonical, normalizeAddress } from "./canonical";
import { decodeRequest } from "./decoder";
import { evaluatePolicy } from "./policy";
import type {
  AnalysisInput,
  AnalysisResult,
  CanonicalReceipt,
  ChainId,
  Hex,
  PolicyOptions,
} from "./types";
import { Verdict } from "./types";

export const ENGINE_VERSION = "1.0.0";
export const DECODER_VERSION = "1.0.0";

function versionCode(version: string): number {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");
  const majorNumber = Number(major);
  const minorNumber = Number(minor);
  const patchNumber = Number(patch);
  if (![majorNumber, minorNumber, patchNumber].every(Number.isSafeInteger)) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  return majorNumber * 1_000_000 + minorNumber * 1_000 + patchNumber;
}

function verdictNumber(verdict: Verdict): number {
  switch (verdict) {
    case Verdict.MATCH:
      return 0;
    case Verdict.MISMATCH:
      return 1;
    case Verdict.CANNOT_VERIFY:
      return 2;
  }
}

export function analyze(input: AnalysisInput, options: PolicyOptions): AnalysisResult {
  if (input.intent.schemaVersion !== 1 || input.request.schemaVersion !== 1) {
    throw new Error("Unsupported IntentGuard schema version");
  }

  const effect = decodeRequest(input.request);
  const evaluation = evaluatePolicy(input, effect, options);
  const intentHash = hashCanonical({ ...input.intent, rawText: undefined });
  const requestHash = hashCanonical(input.request);
  const evidenceHash = hashCanonical(evaluation.evidence);
  const evaluatedAt = options.now ?? Math.floor(Date.now() / 1000);
  const expiresAt = evaluatedAt + 600;

  return {
    status: "COMPLETED",
    verdict: evaluation.verdict,
    primaryReasonCode: evaluation.primaryReasonCode,
    intentHash,
    requestHash,
    evidenceHash,
    intent: input.intent,
    request: input.request,
    decodedEffect: effect,
    rules: evaluation.rules,
    evidence: evaluation.evidence,
    explanation: evaluation.explanation,
    engineVersion: ENGINE_VERSION,
    decoderVersion: DECODER_VERSION,
    evaluatedAt,
    expiresAt,
  };
}

export function makeReceipt(args: {
  analysis: AnalysisResult;
  policyId?: Hex;
  subject: string;
  evaluator: string;
  policyVersion?: number;
  receiptId?: Hex;
}): CanonicalReceipt {
  const receiptId = args.receiptId ?? (`0x${Buffer.from(randomBytes(32)).toString("hex")}` as Hex);
  const chainId: ChainId = args.analysis.intent.chainId;

  return {
    schemaVersion: 1,
    receiptId,
    policyId: args.policyId ?? (`0x${"00".repeat(32)}` as Hex),
    intentHash: args.analysis.intentHash,
    requestHash: args.analysis.requestHash,
    evidenceHash: args.analysis.evidenceHash,
    chainId,
    subject: normalizeAddress(args.subject),
    evaluator: normalizeAddress(args.evaluator),
    verdict: args.analysis.verdict,
    policyVersion: args.policyVersion ?? 0,
    evaluatedAt: args.analysis.evaluatedAt,
    expiresAt: args.analysis.expiresAt,
    engineVersion: versionCode(args.analysis.engineVersion),
    decoderVersion: versionCode(args.analysis.decoderVersion),
    limitations: [
      "This receipt evaluates the supplied request against the supplied intent.",
      "MATCH is not a guarantee that the target contract is honest or bug-free.",
      "The receipt does not prevent a user from signing elsewhere.",
    ],
  };
}

export function receiptHash(receipt: CanonicalReceipt): Hex {
  return hashCanonical(receipt);
}

export const RECEIPT_TYPES = {
  Receipt: [
    { name: "receiptId", type: "bytes32" },
    { name: "policyId", type: "bytes32" },
    { name: "intentHash", type: "bytes32" },
    { name: "requestHash", type: "bytes32" },
    { name: "evidenceHash", type: "bytes32" },
    { name: "chainId", type: "uint256" },
    { name: "subject", type: "address" },
    { name: "evaluator", type: "address" },
    { name: "verdict", type: "uint8" },
    { name: "policyVersion", type: "uint64" },
    { name: "evaluatedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "engineVersion", type: "uint32" },
    { name: "decoderVersion", type: "uint32" },
  ],
} as const;

export function receiptTypedData(args: {
  registryAddress: string;
  receipt: CanonicalReceipt;
}): {
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  types: typeof RECEIPT_TYPES;
  value: Record<string, string | number>;
} {
  return {
    domain: {
      name: "IntentGuard Receipt Registry",
      version: "1",
      chainId: args.receipt.chainId,
      verifyingContract: normalizeAddress(args.registryAddress),
    },
    types: RECEIPT_TYPES,
    value: {
      receiptId: args.receipt.receiptId,
      policyId: args.receipt.policyId,
      intentHash: args.receipt.intentHash,
      requestHash: args.receipt.requestHash,
      evidenceHash: args.receipt.evidenceHash,
      chainId: args.receipt.chainId,
      subject: args.receipt.subject,
      evaluator: args.receipt.evaluator,
      verdict: verdictNumber(args.receipt.verdict),
      policyVersion: args.receipt.policyVersion,
      evaluatedAt: args.receipt.evaluatedAt,
      expiresAt: args.receipt.expiresAt,
      engineVersion: args.receipt.engineVersion,
      decoderVersion: args.receipt.decoderVersion,
    },
  };
}

export function receiptStruct(receipt: CanonicalReceipt): {
  receiptId: Hex;
  policyId: Hex;
  intentHash: Hex;
  requestHash: Hex;
  evidenceHash: Hex;
  chainId: number;
  subject: string;
  evaluator: string;
  verdict: number;
  policyVersion: number;
  evaluatedAt: number;
  expiresAt: number;
  engineVersion: number;
  decoderVersion: number;
} {
  return {
    receiptId: receipt.receiptId,
    policyId: receipt.policyId,
    intentHash: receipt.intentHash,
    requestHash: receipt.requestHash,
    evidenceHash: receipt.evidenceHash,
    chainId: receipt.chainId,
    subject: receipt.subject,
    evaluator: receipt.evaluator,
    verdict: verdictNumber(receipt.verdict),
    policyVersion: receipt.policyVersion,
    evaluatedAt: receipt.evaluatedAt,
    expiresAt: receipt.expiresAt,
    engineVersion: receipt.engineVersion,
    decoderVersion: receipt.decoderVersion,
  };
}
