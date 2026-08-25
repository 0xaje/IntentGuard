/**
 * IntentGuard + ElizaOS Evaluator Plugin
 *
 * Demonstrates an action evaluator plugin for the ElizaOS agent framework.
 * Intercepts autonomous agent message execution and asserts intent fidelity before transaction dispatch.
 */

import { verifyAgentAction, buildErc20ApproveData } from "../engine/src";
import type { IntentSpec, ProposedRequest } from "../engine/src";

export interface ElizaMemory {
  userId: string;
  room: string;
  content: {
    text: string;
    action?: string;
    params?: Record<string, unknown>;
  };
}

export interface ElizaState {
  currentIntent?: IntentSpec;
}

export const intentGuardElizaPlugin = {
  name: "intentguard-fidelity-plugin",
  description: "Deterministic intent fidelity & attestation evaluator for ElizaOS agents on Base",

  evaluator: {
    name: "INTENTGUARD_PREFLIGHT_EVALUATOR",
    async handler(proposedTx: ProposedRequest, state: ElizaState) {
      if (!state.currentIntent) {
        return {
          valid: false,
          reason: "No active human IntentSpec declared in Eliza state.",
        };
      }

      const check = verifyAgentAction({
        intent: state.currentIntent,
        request: proposedTx,
      });

      return {
        valid: check.isSafe,
        verdict: check.verdict,
        code: check.primaryReasonCode,
        message: check.explanation,
        receipt: check.analysis,
      };
    },
  },
};

// --- DEMO RUNNER ---
async function main() {
  console.log("=================================================");
  console.log("🤖  IntentGuard + ElizaOS Evaluator Plugin Demo");
  console.log("=================================================\n");

  const humanState: ElizaState = {
    currentIntent: {
      schemaVersion: 1,
      chainId: 8453,
      action: "APPROVE",
      asset: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      spender: { exact: "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad" }, // Uniswap Universal Router
      spendCap: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", maxRaw: "50000000" }, // 50 USDC max
      approvalPolicy: "EXACT_ONLY",
      permitPolicy: "NOT_APPLICABLE",
      allowNativeValue: false,
      allowUnknownSelectors: false,
    },
  };

  // Case 1: Eliza proposes exact approval for 50 USDC
  const safeApproval: ProposedRequest = {
    schemaVersion: 1,
    chainId: 8453,
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    data: buildErc20ApproveData("0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", "50000000"),
    valueWei: "0",
  };

  const eval1 = await intentGuardElizaPlugin.evaluator.handler(safeApproval, humanState);
  console.log("Eliza Exact Approval Check:", eval1.verdict, "-> Valid:", eval1.valid);
  console.log("Explanation:", eval1.message, "\n");

  // Case 2: Eliza gets tricked into sending uint256.max (unlimited approval)
  const unlimitedApproval: ProposedRequest = {
    schemaVersion: 1,
    chainId: 8453,
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    data: buildErc20ApproveData("0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", ((1n << 256n) - 1n).toString()),
    valueWei: "0",
  };

  const eval2 = await intentGuardElizaPlugin.evaluator.handler(unlimitedApproval, humanState);
  console.log("Eliza Unlimited Approval Check:", eval2.verdict, "-> Valid:", eval2.valid);
  console.log("Primary Reason Code:", eval2.code);
  console.log("Explanation:", eval2.message);
}

if (process.argv[1]?.includes("eliza-integration")) {
  main().catch(console.error);
}
