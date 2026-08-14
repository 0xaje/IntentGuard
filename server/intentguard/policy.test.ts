import { describe, expect, it } from "vitest";
import type { StructuredIntent } from "@shared/intentguard";
import type { TransactionInspection } from "./baseRpc";
import { evaluateIntentAgainstTransaction } from "./policy";

const transferIntent: StructuredIntent = {
  chain: "base",
  action: "transfer",
  inputToken: "USDC",
  outputToken: "USDC",
  maxSpendUsdc: 25,
  maxSlippagePercent: null,
  prohibitUnlimitedApproval: true,
  recipient: "0x1111111111111111111111111111111111111111",
  sourceText: "Send 25 USDC to this address on Base. Never spend more than 25 USDC.",
};

function inspection(overrides: Partial<TransactionInspection> = {}): TransactionInspection {
  return {
    transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    networkChainId: "0x2105",
    transaction: {
      from: "0x2222222222222222222222222222222222222222",
      to: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      valueEth: "0",
      blockNumber: "0x1",
    },
    receipt: { state: "success", blockNumber: "0x1" },
    decoded: {
      kind: "transfer",
      selector: "0xa9059cbb",
      token: "USDC",
      amountRaw: "25000000",
      recipient: transferIntent.recipient,
      spender: null,
    },
    observations: { approvals: [], transfers: [], spentUsdcRaw: "25000000" },
    ...overrides,
  };
}

describe("deterministic intent policy", () => {
  it("returns MATCH when the Base USDC transfer satisfies every explicit constraint", () => {
    const result = evaluateIntentAgainstTransaction(transferIntent, inspection());
    expect(result.verdict).toBe("MATCH");
    expect(result.failedChecks).toBe(0);
  });

  it("returns MISMATCH when an unlimited approval conflicts with the intent", () => {
    const result = evaluateIntentAgainstTransaction(transferIntent, inspection({
      decoded: { kind: "approve", selector: "0x095ea7b3", token: "USDC", amountRaw: ((1n << 256n) - 1n).toString(), recipient: null, spender: "0x3333333333333333333333333333333333333333" },
      observations: { approvals: [{ owner: "0x2222222222222222222222222222222222222222", spender: "0x3333333333333333333333333333333333333333", amountRaw: ((1n << 256n) - 1n).toString(), unlimited: true }], transfers: [], spentUsdcRaw: null },
    }));
    expect(result.verdict).toBe("MISMATCH");
    expect(result.evidence.find((item) => item.id === "approval")?.state).toBe("failed");
  });

  it("returns MISMATCH when the observed network is not Base", () => {
    const result = evaluateIntentAgainstTransaction(transferIntent, inspection({ networkChainId: "0x1" }));
    expect(result.verdict).toBe("MISMATCH");
  });

  it("returns UNVERIFIABLE when receipt evidence is unavailable", () => {
    const result = evaluateIntentAgainstTransaction(transferIntent, inspection({ receipt: { state: "pending", blockNumber: null } }));
    expect(result.verdict).toBe("UNVERIFIABLE");
  });
});
