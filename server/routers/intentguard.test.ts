import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requiredTrustLoopKeys = [
  "BASE_SEPOLIA_RPC_URL",
  "EVALUATOR_PRIVATE_KEY",
  "POLICY_REGISTRY_ADDRESS",
  "RECEIPT_REGISTRY_ADDRESS",
] as const;

const savedEnvironment = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of requiredTrustLoopKeys) {
    savedEnvironment.set(key, process.env[key]);
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of requiredTrustLoopKeys) {
    const value = savedEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnvironment.clear();
});

describe("IntentGuard trust-loop configuration boundary", () => {
  it("fails closed without a Base Sepolia RPC, evaluator key, and deployed registry addresses", async () => {
    const { intentGuardRouter } = await import("./intentguard");
    const caller = intentGuardRouter.createCaller({} as never);

    await expect(caller.commitPolicy({
      intent: {
        chain: "base",
        action: "swap",
        inputToken: "USDC",
        outputToken: "ETH",
        maxSpendUsdc: 100,
        maxSlippagePercent: 1,
        prohibitUnlimitedApproval: true,
        recipient: null,
        sourceText: "Swap 100 USDC for ETH on Base with maximum slippage 1 percent.",
      },
      validForSeconds: 86_400,
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Trust-loop infrastructure is not configured"),
    });
  });
});
