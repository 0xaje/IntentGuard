import { TypedDataEncoder, getAddress, keccak256, toUtf8Bytes, verifyTypedData } from "ethers";
import { hashCanonical, receiptTypedData, type CanonicalReceipt, type Hex, Verdict } from "../../engine/src/index";
import type { StructuredIntent, VerificationResult } from "@shared/intentguard";
import type { TransactionInspection } from "./baseRpc";

export const CRYPTO_POLICY_VERSION = 1;
export const CRYPTO_ENGINE_VERSION = 1_000_000;
export const CRYPTO_DECODER_VERSION = 1_000_000;
export const ZERO_HASH = `0x${"00".repeat(32)}` as Hex;

export const RECEIPT_TYPE_STRING = "Receipt(bytes32 receiptId,bytes32 policyId,bytes32 intentHash,bytes32 requestHash,bytes32 evidenceHash,uint256 chainId,address transactionSubject,address evaluator,uint8 verdict,uint64 policyVersion,uint64 evaluatedAt,uint64 expiresAt,uint32 engineVersion,uint32 decoderVersion)";

function scaledDecimal(value: number, decimals: number, field: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a non-negative finite number.`);
  const multiplier = 10 ** decimals;
  const scaled = Math.round(value * multiplier);
  if (!Number.isSafeInteger(scaled) || Math.abs(scaled / multiplier - value) > 1e-9) {
    throw new Error(`${field} cannot be represented at the required canonical precision.`);
  }
  return scaled.toString();
}

function normalizedRecipient(recipient: string | null) {
  return recipient ? getAddress(recipient).toLowerCase() : null;
}

export function canonicalIntentSpec(intent: StructuredIntent, policyVersion = CRYPTO_POLICY_VERSION) {
  if (!Number.isSafeInteger(policyVersion) || policyVersion <= 0) throw new Error("policyVersion must be a positive safe integer.");
  return {
    schemaVersion: 1,
    policyVersion,
    chain: intent.chain,
    action: intent.action,
    inputToken: intent.inputToken,
    outputToken: intent.outputToken,
    maxSpendMicros: scaledDecimal(intent.maxSpendUsdc, 6, "maxSpendUsdc"),
    maxSlippageBasisPoints: intent.maxSlippagePercent === null ? null : scaledDecimal(intent.maxSlippagePercent, 2, "maxSlippagePercent"),
    recipient: normalizedRecipient(intent.recipient),
    prohibitUnlimitedApproval: intent.prohibitUnlimitedApproval,
  } as const;
}

export function hashIntent(intent: StructuredIntent, policyVersion = CRYPTO_POLICY_VERSION): Hex {
  return hashCanonical(canonicalIntentSpec(intent, policyVersion));
}

export function canonicalRequest(inspection: TransactionInspection) {
  return {
    schemaVersion: 1,
    chainId: inspection.networkChainId.toLowerCase(),
    transactionHash: inspection.transactionHash.toLowerCase(),
    transaction: inspection.raw.transaction,
    receipt: inspection.raw.receipt,
  } as const;
}

export function hashRequest(inspection: TransactionInspection): Hex {
  return hashCanonical(canonicalRequest(inspection));
}

export function canonicalEvidence(result: VerificationResult) {
  return {
    schemaVersion: 1,
    chainId: result.provenance?.chainId ?? 8453,
    blockNumber: result.provenance?.blockNumber ?? null,
    blockHash: result.provenance?.blockHash ?? null,
    transactionHash: result.provenance?.transactionHash ?? null,
    transactionIndex: result.provenance?.transactionIndex ?? null,
    receiptStatus: result.provenance?.receiptStatus ?? null,
    verdict: result.verdict,
    passedChecks: result.passedChecks,
    failedChecks: result.failedChecks,
    unavailableChecks: result.unavailableChecks,
    evidence: [...result.evidence]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({
        id: item.id,
        label: item.label,
        state: item.state,
        detail: item.detail,
        source: item.source,
        blockNumber: item.blockNumber ?? result.provenance?.blockNumber ?? null,
        blockHash: item.blockHash ?? result.provenance?.blockHash ?? null,
      })),
  } as const;
}

export function hashEvidence(result: VerificationResult): Hex {
  return hashCanonical(canonicalEvidence(result));
}

export function toRegistryVerdict(verdict: VerificationResult["verdict"]): Verdict {
  if (verdict === "MATCH") return Verdict.MATCH;
  if (verdict === "MISMATCH") return Verdict.MISMATCH;
  return Verdict.CANNOT_VERIFY;
}

export type TrustReceiptInput = {
  policyId: Hex;
  policyVersion: number;
  intent: StructuredIntent;
  inspection: TransactionInspection;
  verification: VerificationResult;
  evaluator: string;
  evaluatedAt: number;
  expiresAt: number;
};

export type TrustReceipt = {
  receipt: CanonicalReceipt;
  intentHash: Hex;
  requestHash: Hex;
  evidenceHash: Hex;
  receiptHash: Hex;
};

export function buildTrustReceipt(input: TrustReceiptInput): TrustReceipt {
  const subject = input.inspection.transaction?.from;
  if (!subject) throw new Error("Cannot issue a cryptographic receipt because the real transaction subject is unavailable.");
  if (!Number.isSafeInteger(input.policyVersion) || input.policyVersion <= 0) throw new Error("policyVersion must be a positive safe integer.");
  if (!Number.isSafeInteger(input.evaluatedAt) || !Number.isSafeInteger(input.expiresAt) || input.expiresAt <= input.evaluatedAt) {
    throw new Error("Receipt timestamps must form a valid future validity window.");
  }

  const intentHash = hashIntent(input.intent, input.policyVersion);
  const requestHash = hashRequest(input.inspection);
  const evidenceHash = hashEvidence(input.verification);
  const normalizedSubject = getAddress(subject).toLowerCase();
  const normalizedEvaluator = getAddress(input.evaluator).toLowerCase();
  const receiptId = hashCanonical({
    schemaVersion: 1,
    policyId: input.policyId,
    intentHash,
    requestHash,
    evidenceHash,
    chainId: 84532,
    transactionSubject: normalizedSubject,
    evaluator: normalizedEvaluator,
    verdict: input.verification.verdict,
    policyVersion: input.policyVersion,
    evaluatedAt: input.evaluatedAt,
    expiresAt: input.expiresAt,
    engineVersion: CRYPTO_ENGINE_VERSION,
    decoderVersion: CRYPTO_DECODER_VERSION,
  });

  const receipt: CanonicalReceipt = {
    schemaVersion: 1,
    receiptId,
    policyId: input.policyId,
    intentHash,
    requestHash,
    evidenceHash,
    chainId: 84532,
    transactionSubject: normalizedSubject,
    subject: normalizedSubject,
    evaluator: normalizedEvaluator,
    verdict: toRegistryVerdict(input.verification.verdict),
    policyVersion: input.policyVersion,
    evaluatedAt: input.evaluatedAt,
    expiresAt: input.expiresAt,
    engineVersion: CRYPTO_ENGINE_VERSION,
    decoderVersion: CRYPTO_DECODER_VERSION,
    limitations: [
      "This receipt binds deterministic verification evidence for the observed transaction.",
      "A read-only quote is not historical execution evidence.",
      "The receipt does not execute or prevent a user transaction.",
    ],
  };

  return {
    receipt,
    intentHash,
    requestHash,
    evidenceHash,
    receiptHash: hashCanonical(receipt),
  };
}

export function receiptTypedDataForRegistry(registryAddress: string, receipt: CanonicalReceipt) {
  return receiptTypedData({ registryAddress, receipt });
}

export function receiptEip712Digest(registryAddress: string, receipt: CanonicalReceipt): Hex {
  const typedData = receiptTypedDataForRegistry(registryAddress, receipt);
  const types = { Receipt: typedData.types.Receipt.map(({ name, type }) => ({ name, type })) };
  return TypedDataEncoder.hash(typedData.domain, types, typedData.value) as Hex;
}

export function recoverReceiptEvaluator(registryAddress: string, receipt: CanonicalReceipt, signature: string) {
  const typedData = receiptTypedDataForRegistry(registryAddress, receipt);
  const types = { Receipt: typedData.types.Receipt.map(({ name, type }) => ({ name, type })) };
  return verifyTypedData(typedData.domain, types, typedData.value, signature).toLowerCase();
}

export function receiptTypeHash(): Hex {
  return keccak256(toUtf8Bytes(RECEIPT_TYPE_STRING)) as Hex;
}
