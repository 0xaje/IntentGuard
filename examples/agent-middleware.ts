/**
 * IntentGuard Agent Guardrail Middleware Example
 *
 * Demonstrates how an AI agent framework (e.g. Coinbase AgentKit, Eliza, LangChain)
 * wraps transaction broadcast with IntentGuard deterministic validation.
 *
 * The LLM may propose any calldata, but IntentGuard guarantees that if the calldata
 * violates human intent (overspending, wrong recipient, unlimited approval, slippage drift),
 * the execution is deterministically blocked BEFORE touching the network.
 */

import { verifyAgentAction, buildErc20TransferData } from "../engine/src";
import type { IntentSpec, ProposedRequest } from "../engine/src";

// 1. Human defines the intent constraints (e.g., via natural language or system prompt)
const userIntent: IntentSpec = {
  schemaVersion: 1,
  chainId: 8453, // Base Mainnet
  action: "TRANSFER",
  asset: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  },
  recipient: {
    exact: "0xb8069ea05dca32f8116f1af6bb719155274010fa", // Alice
  },
  spendCap: {
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    maxRaw: "10000000", // Exactly 10 USDC max (6 decimals)
  },
  approvalPolicy: "EXACT_ONLY",
  permitPolicy: "NOT_APPLICABLE",
  allowNativeValue: false,
  allowUnknownSelectors: false,
};

// 2. Safe transaction scenario: Agent constructs a valid transfer of 10 USDC
const safeAgentProposal: ProposedRequest = {
  schemaVersion: 1,
  chainId: 8453,
  to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC contract
  data: buildErc20TransferData("0xb8069ea05dca32f8116f1af6bb719155274010fa", "10000000"), // 10 USDC
  valueWei: "0",
};

console.log("\n--- Scenario 1: Safe Agent Action ---");
const safeCheck = verifyAgentAction({
  intent: userIntent,
  request: safeAgentProposal,
});

console.log("Verdict:", safeCheck.verdict); // "MATCH"
console.log("Is safe to sign & broadcast:", safeCheck.isSafe); // true
console.log("Explanation:", safeCheck.explanation);

// 3. Rogue/Attacked transaction scenario: Prompt injection causes agent to send 50 USDC (exceeds cap)
const rogueAgentProposal: ProposedRequest = {
  schemaVersion: 1,
  chainId: 8453,
  to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  data: buildErc20TransferData("0xb8069ea05dca32f8116f1af6bb719155274010fa", "50000000"), // 50 USDC (violates 10 cap)
  valueWei: "0",
};

console.log("\n--- Scenario 2: Rogue Overspend (Prompt Injection / Hallucination) ---");
const rogueCheck = verifyAgentAction({
  intent: userIntent,
  request: rogueAgentProposal,
});

console.log("Verdict:", rogueCheck.verdict); // "MISMATCH"
console.log("Is safe to sign & broadcast:", rogueCheck.isSafe); // false
console.log("Primary Reason:", rogueCheck.primaryReasonCode); // "IG-AMOUNT-001"
console.log("Explanation:", rogueCheck.explanation);

// 4. Reusable Middleware wrapper function
export function withIntentGuard<T>(
  intent: IntentSpec,
  sendTx: (req: ProposedRequest) => Promise<T>,
) {
  return async (req: ProposedRequest): Promise<T> => {
    const check = verifyAgentAction({ intent, request: req });
    if (!check.isSafe) {
      throw new Error(
        `[IntentGuard] Transaction blocked! Verdict: ${check.verdict}. Reason: ${check.primaryReasonCode} - ${check.explanation}`,
      );
    }
    console.log(`[IntentGuard] Deterministic check passed (${check.verdict}). Proceeding to broadcast.`);
    return sendTx(req);
  };
}
