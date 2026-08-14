import { describe, expect, it } from "vitest";
import { BASE_USDC_ADDRESS, BASE_WETH_ADDRESS, UNISWAP_V3_SWAP_ROUTER_02_ADDRESS, type StructuredIntent } from "@shared/intentguard";
import type { TransactionInspection } from "./baseRpc";
import { evaluateIntentAgainstTransaction } from "./policy";

const transferIntent: StructuredIntent = { chain: "base", action: "transfer", inputToken: "USDC", outputToken: "USDC", maxSpendUsdc: 25, maxSlippagePercent: null, prohibitUnlimitedApproval: true, recipient: "0x1111111111111111111111111111111111111111", sourceText: "Send 25 USDC to this address on Base. Never spend more than 25 USDC." };
const swapIntent: StructuredIntent = { chain: "base", action: "swap", inputToken: "USDC", outputToken: "ETH", maxSpendUsdc: 100, maxSlippagePercent: 1, prohibitUnlimitedApproval: true, recipient: null, sourceText: "Swap $100 USDC for ETH on Base. Maximum slippage 1%. Don't allow unlimited approvals." };

function inspection(overrides: Partial<TransactionInspection> = {}): TransactionInspection {
  return {
    transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    networkChainId: "0x2105",
    transaction: { from: "0x2222222222222222222222222222222222222222", to: BASE_USDC_ADDRESS, valueEth: "0", blockNumber: "0x1" },
    receipt: { state: "success", blockNumber: "0x1" },
    decoded: { kind: "transfer", selector: "0xa9059cbb", token: "USDC", amountRaw: "25000000", recipient: transferIntent.recipient, spender: null, routerSwap: null },
    simulation: { state: "not-applicable", protocol: null, contractAddress: null, method: null, selector: null, amountOutRaw: null, sqrtPriceX96AfterRaw: null, initializedTicksCrossed: null, gasEstimate: null, blockTag: null, detail: "No allowlisted swap was decoded." },
    observations: { approvals: [], transfers: [], spentUsdcRaw: "25000000" },
    raw: { transaction: null, receipt: null },
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
      decoded: { kind: "approve", selector: "0x095ea7b3", token: "USDC", amountRaw: ((1n << 256n) - 1n).toString(), recipient: null, spender: "0x3333333333333333333333333333333333333333", routerSwap: null },
      observations: { approvals: [{ owner: "0x2222222222222222222222222222222222222222", spender: "0x3333333333333333333333333333333333333333", amountRaw: ((1n << 256n) - 1n).toString(), unlimited: true }], transfers: [], spentUsdcRaw: null },
    }));
    expect(result.verdict).toBe("MISMATCH");
    expect(result.evidence.find((item) => item.id === "approval")?.state).toBe("failed");
  });

  it("surfaces a read-only quote while keeping a swap unverifiable without historical execution proof", () => {
    const result = evaluateIntentAgainstTransaction(swapIntent, inspection({
      transaction: { from: "0x2222222222222222222222222222222222222222", to: UNISWAP_V3_SWAP_ROUTER_02_ADDRESS, valueEth: "0", blockNumber: "0x1" },
      decoded: { kind: "uniswap-v3-exact-input-single", selector: "0x04e45aaf", token: "USDC", amountRaw: "100000000", recipient: "0x2222222222222222222222222222222222222222", spender: null, routerSwap: { protocol: "uniswap-v3-swap-router-02", tokenIn: BASE_USDC_ADDRESS, tokenOut: BASE_WETH_ADDRESS, fee: 3000, recipient: "0x2222222222222222222222222222222222222222", amountInRaw: "100000000", amountOutMinimumRaw: "1", sqrtPriceLimitX96Raw: "0" } },
      simulation: { state: "available", protocol: "uniswap-v3-quoter-v2", contractAddress: "0x3d4e44eb1374240ce5f1b871ab261cd16335b76a", method: "eth_call", selector: "0xc6a5026a", amountOutRaw: "50000000000000000", sqrtPriceX96AfterRaw: "1", initializedTicksCrossed: 2, gasEstimate: "120000", blockTag: "latest", detail: "Read-only quote available." },
      observations: { approvals: [], transfers: [], spentUsdcRaw: "100000000" },
    }));
    expect(result.verdict).toBe("UNVERIFIABLE");
    expect(result.evidence.find((item) => item.id === "action")?.state).toBe("verified");
    expect(result.evidence.find((item) => item.id === "quote-simulation")?.state).toBe("verified");
    expect(result.evidence.find((item) => item.id === "expected-output")?.state).toBe("unavailable");
  });

  it("does not treat an allowlisted WETH-to-USDC route as a USDC spend", () => {
    const result = evaluateIntentAgainstTransaction(swapIntent, inspection({
      transaction: { from: "0x2222222222222222222222222222222222222222", to: UNISWAP_V3_SWAP_ROUTER_02_ADDRESS, valueEth: "0", blockNumber: "0x1" },
      decoded: { kind: "uniswap-v3-exact-input-single", selector: "0x04e45aaf", token: null, amountRaw: "50000000000000000", recipient: "0x2222222222222222222222222222222222222222", spender: null, routerSwap: { protocol: "uniswap-v3-swap-router-02", tokenIn: BASE_WETH_ADDRESS, tokenOut: BASE_USDC_ADDRESS, fee: 3000, recipient: "0x2222222222222222222222222222222222222222", amountInRaw: "50000000000000000", amountOutMinimumRaw: "1", sqrtPriceLimitX96Raw: "0" } },
      simulation: { state: "available", protocol: "uniswap-v3-quoter-v2", contractAddress: "0x3d4e44eb1374240ce5f1b871ab261cd16335b76a", method: "eth_call", selector: "0xc6a5026a", amountOutRaw: "10655700", sqrtPriceX96AfterRaw: "1", initializedTicksCrossed: 2, gasEstimate: "120000", blockTag: "latest", detail: "Read-only quote available." },
      observations: { approvals: [], transfers: [], spentUsdcRaw: null },
    }));
    expect(result.evidence.find((item) => item.id === "spend-limit")?.state).toBe("unavailable");
    expect(result.evidence.find((item) => item.id === "quote-simulation")?.detail).toContain("10.6557 USDC");
    expect(result.evidence.find((item) => item.id === "input-asset")?.state).toBe("unavailable");
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
