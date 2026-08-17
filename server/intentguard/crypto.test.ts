import { describe, expect, it } from "vitest";
import { Wallet } from "ethers";
import type { StructuredIntent, VerificationResult } from "@shared/intentguard";
import type { TransactionInspection } from "./baseRpc";
import {
  ZERO_HASH,
  buildTrustReceipt,
  hashEvidence,
  hashIntent,
  hashRequest,
  receiptEip712Digest,
  receiptTypeHash,
  receiptTypedDataForRegistry,
  recoverReceiptEvaluator,
} from "./crypto";

const recipient = "0x1111111111111111111111111111111111111111";
const subject = "0x2222222222222222222222222222222222222222";
const evaluator = "0x3333333333333333333333333333333333333333";
const registry = "0x4444444444444444444444444444444444444444";

const intent: StructuredIntent = {
  chain: "base",
  action: "transfer",
  inputToken: "USDC",
  outputToken: "USDC",
  maxSpendUsdc: 25,
  maxSlippagePercent: null,
  prohibitUnlimitedApproval: true,
  recipient,
  sourceText: "Send 25 USDC to the destination on Base.",
};

const verification: VerificationResult = {
  receiptId: "IG-LOCAL",
  verdict: "MATCH",
  summary: "Every required fact was verified.",
  passedChecks: 6,
  failedChecks: 0,
  unavailableChecks: 0,
  observedAt: "2026-08-17T00:00:00.000Z",
  evidence: [
    { id: "chain", label: "Network is Base", state: "verified", detail: "Base chain verified.", source: "Base RPC", blockNumber: 1, blockHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    { id: "execution", label: "Mined execution", state: "verified", detail: "Receipt succeeded.", source: "Transaction receipt", blockNumber: 1, blockHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  ],
  provenance: {
    source: "Base JSON-RPC",
    chainId: 8453,
    blockNumber: 1,
    blockHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    transactionIndex: 0,
    receiptStatus: "mined_success",
    contractAddress: recipient,
    decoder: "ERC-20 transfer(address,uint256)",
    decoderVersion: 1,
    engineVersion: 1,
    evidenceHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  },
};

const inspection: TransactionInspection = {
  transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  networkChainId: "0x2105",
  transaction: { from: subject, to: recipient, valueEth: "0", blockNumber: "0x1" },
  receipt: { state: "success", blockNumber: "0x1" },
  decoded: { kind: "transfer", selector: "0xa9059cbb", token: "USDC", amountRaw: "25000000", recipient, spender: null, routerSwap: null },
  simulation: { state: "not-applicable", protocol: null, contractAddress: null, method: null, selector: null, amountOutRaw: null, sqrtPriceX96AfterRaw: null, initializedTicksCrossed: null, gasEstimate: null, blockTag: null, detail: "Not applicable." },
  tokenMetadata: { input: null, output: null },
  observations: { approvals: [], transfers: [], spentUsdcRaw: "25000000" },
  raw: {
    transaction: { from: subject, to: recipient, input: "0xa9059cbb", value: "0x0", blockNumber: "0x1" },
    receipt: { status: "0x1", blockNumber: "0x1", logs: [] },
  },
};

describe("IntentGuard canonical trust hashes", () => {
  it("returns the same intent hash regardless of object-key order or raw natural-language text", () => {
    const reordered: StructuredIntent = {
      sourceText: "A completely different sentence must not change the protocol commitment.",
      recipient: intent.recipient,
      prohibitUnlimitedApproval: intent.prohibitUnlimitedApproval,
      maxSlippagePercent: intent.maxSlippagePercent,
      maxSpendUsdc: intent.maxSpendUsdc,
      outputToken: intent.outputToken,
      inputToken: intent.inputToken,
      action: intent.action,
      chain: intent.chain,
    };
    expect(hashIntent(intent)).toBe(hashIntent(reordered));
  });

  it("changes the intent hash when an enforced constraint, recipient, or policy version changes", () => {
    expect(hashIntent(intent)).not.toBe(hashIntent({ ...intent, maxSpendUsdc: 26 }));
    expect(hashIntent(intent)).not.toBe(hashIntent({ ...intent, recipient: "0x5555555555555555555555555555555555555555" }));
    expect(hashIntent(intent, 1)).not.toBe(hashIntent(intent, 2));
  });

  it("returns deterministic request and evidence hashes from structured observable data", () => {
    expect(hashRequest(inspection)).toBe(hashRequest({ ...inspection }));
    expect(hashEvidence(verification)).toBe(hashEvidence({ ...verification, evidence: [...verification.evidence].reverse() }));
  });

  it("changes the evidence hash when blockchain block anchoring context changes", () => {
    expect(hashEvidence(verification)).not.toBe(
      hashEvidence({
        ...verification,
        provenance: { ...verification.provenance, blockNumber: 2 },
      }),
    );
    expect(hashEvidence(verification)).not.toBe(
      hashEvidence({
        ...verification,
        provenance: { ...verification.provenance, blockHash: "0x0000000000000000000000000000000000000000000000000000000000000000" },
      }),
    );
    expect(hashEvidence(verification)).not.toBe(
      hashEvidence({
        ...verification,
        provenance: { ...verification.provenance, transactionIndex: 5 },
      }),
    );
  });
});

describe("IntentGuard EIP-712 receipts", () => {
  it("matches the exact Solidity Receipt type hash and recovers the signing evaluator", async () => {
    const signer = Wallet.createRandom();
    const trustReceipt = buildTrustReceipt({
      policyId: ZERO_HASH,
      policyVersion: 1,
      intent,
      inspection,
      verification,
      evaluator: signer.address,
      evaluatedAt: 1_700_000_000,
      expiresAt: 1_700_000_600,
    });
    const typed = receiptTypedDataForRegistry(registry, trustReceipt.receipt);
    const types = { Receipt: typed.types.Receipt.map((field) => ({ name: field.name, type: field.type })) };
    const signature = await signer.signTypedData(typed.domain, types, typed.value);
    expect(receiptTypeHash()).toBe("0x018c9f3900967057c49face3f3c0b093f4f06eddaac8c90913abaaa53e4d6dfe");
    expect(receiptEip712Digest(registry, trustReceipt.receipt)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(recoverReceiptEvaluator(registry, trustReceipt.receipt, signature)).toBe(signer.address.toLowerCase());
    expect(trustReceipt.receipt.transactionSubject).toBe(subject);
    expect(trustReceipt.receipt.policyId).toBe(ZERO_HASH);
  });
});
