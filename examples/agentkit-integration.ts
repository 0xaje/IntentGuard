/**
 * IntentGuard + Coinbase AgentKit Integration
 *
 * Demonstrates a native Action Provider wrapper for Coinbase AgentKit on Base.
 * Intercepts LLM-generated AgentKit actions before they trigger on-chain execution.
 */

import { verifyAgentAction, buildErc20TransferData } from "../engine/src";
import type { IntentSpec, ProposedRequest } from "../engine/src";

export interface AgentKitAction {
  name: string;
  description: string;
  targetAddress: string;
  calldata: `0x${string}`;
  valueWei?: string;
}

export class IntentGuardAgentKitProvider {
  private intent: IntentSpec;
  private chainId: number;

  constructor(intent: IntentSpec) {
    this.intent = intent;
    this.chainId = intent.chainId;
  }

  /**
   * Evaluates an AgentKit action proposal against the user's declared IntentSpec.
   */
  public evaluateAction(action: AgentKitAction) {
    const request: ProposedRequest = {
      schemaVersion: 1,
      chainId: this.chainId,
      to: action.targetAddress,
      data: action.calldata,
      valueWei: action.valueWei ?? "0",
    };

    const check = verifyAgentAction({
      intent: this.intent,
      request,
    });

    return {
      isApproved: check.isSafe,
      verdict: check.verdict,
      reason: check.primaryReasonCode,
      explanation: check.explanation,
      receipt: check.analysis,
    };
  }
}

// --- DEMO RUNNER ---
async function main() {
  console.log("=================================================");
  console.log("🛡️  IntentGuard + Coinbase AgentKit Guardrail Demo");
  console.log("=================================================\n");

  const humanPolicy: IntentSpec = {
    schemaVersion: 1,
    chainId: 8453, // Base Mainnet
    action: "TRANSFER",
    asset: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, // USDC
    recipient: { exact: "0xb8069ea05dca32f8116f1af6bb719155274010fa" }, // Alice
    spendCap: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", maxRaw: "25000000" }, // 25 USDC
    approvalPolicy: "EXACT_ONLY",
    permitPolicy: "NOT_APPLICABLE",
    allowNativeValue: false,
    allowUnknownSelectors: false,
  };

  const guard = new IntentGuardAgentKitProvider(humanPolicy);

  // 1. AgentKit Action 1: Valid transfer of 20 USDC
  const validAction: AgentKitAction = {
    name: "transfer_usdc",
    description: "Transfer 20 USDC to Alice",
    targetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    calldata: buildErc20TransferData("0xb8069ea05dca32f8116f1af6bb719155274010fa", "20000000"),
  };

  const res1 = guard.evaluateAction(validAction);
  console.log("Action 1 (Transfer 20 USDC):", res1.verdict, "-> Safe:", res1.isApproved);
  console.log("Explanation:", res1.explanation, "\n");

  // 2. AgentKit Action 2: Prompt Injection / Hijack to attacker address
  const hijackedAction: AgentKitAction = {
    name: "transfer_usdc",
    description: "Transfer 20 USDC to 0xHacker",
    targetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    calldata: buildErc20TransferData("0x999999cf1046e68e36e1aa2e0e07105eddd840bd", "20000000"),
  };

  const res2 = guard.evaluateAction(hijackedAction);
  console.log("Action 2 (Hijack Attempt to Attacker):", res2.verdict, "-> Safe:", res2.isApproved);
  console.log("Primary Reason:", res2.reason);
  console.log("Explanation:", res2.explanation);
}

if (process.argv[1]?.includes("agentkit-integration")) {
  main().catch(console.error);
}
