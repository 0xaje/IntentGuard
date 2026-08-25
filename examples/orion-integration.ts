/**
 * IntentGuard + Orion Agent Integration Prototype
 *
 * Demonstrates how an autonomous Orion Agent operating on Base uses IntentGuard
 * middleware to verify intent fidelity, fail-closed safety, and on-chain
 * EIP-712 cryptographic attestation before continuing execution.
 */

import { verifyAgentAction, createAgentGuardrail, buildErc20TransferData } from "../engine/src";
import type { IntentSpec, ProposedRequest, AnalysisResult } from "../engine/src";

// Mock interface for the Orion Agent Framework
export interface OrionTransactionPlan {
  agentId: string;
  agentVersion: string;
  targetAddress: string;
  calldata: `0x${string}`;
  valueWei?: string;
  estimatedGas?: string;
}

export class OrionAgentFidelityGuard {
  private activeIntent: IntentSpec;

  constructor(intent: IntentSpec) {
    this.activeIntent = intent;
  }

  /**
   * Preflight verification hook for Orion Agent planning cycle.
   * Evaluates proposed calldata BEFORE the Orion agent signs or broadcasts.
   */
  public verifyOrionProposal(proposal: OrionTransactionPlan) {
    const request: ProposedRequest = {
      schemaVersion: 1,
      chainId: this.activeIntent.chainId,
      to: proposal.targetAddress,
      data: proposal.calldata,
      valueWei: proposal.valueWei ?? "0",
      agentId: proposal.agentId,
      agentVersion: proposal.agentVersion,
      source: "ORION_AGENT",
    };

    const result = verifyAgentAction({
      intent: this.activeIntent,
      request,
    });

    return {
      canExecute: result.isSafe,
      verdict: result.verdict,
      reasonCode: result.primaryReasonCode,
      explanation: result.explanation,
      intentHash: result.analysis.intentHash,
      requestHash: result.analysis.requestHash,
      evidenceHash: result.analysis.evidenceHash,
      analysis: result.analysis,
    };
  }
}

// --- DEMO EXECUTION ---
async function main() {
  console.log("==========================================================");
  console.log("🛡️  IntentGuard x Orion Agent Fidelity Layer (Base 8453)");
  console.log("==========================================================\n");

  // 1. User declares intent on Base
  const userIntent: IntentSpec = {
    schemaVersion: 1,
    chainId: 8453, // Base Mainnet
    action: "TRANSFER",
    asset: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, // USDC
    recipient: { exact: "0xb8069ea05dca32f8116f1af6bb719155274010fa" }, // Alice
    spendCap: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", maxRaw: "10000000" }, // 10 USDC max
    approvalPolicy: "EXACT_ONLY",
    permitPolicy: "NOT_APPLICABLE",
    allowNativeValue: false,
    allowUnknownSelectors: false,
  };

  const orionGuard = new OrionAgentFidelityGuard(userIntent);

  // 2. Orion Agent Scenario A: Faithful Execution (10 USDC Transfer)
  console.log("--- Orion Scenario A: Faithful Agent Plan ---");
  const faithfulPlan: OrionTransactionPlan = {
    agentId: "orion-defi-agent-v1",
    agentVersion: "1.0.4",
    targetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    calldata: buildErc20TransferData("0xb8069ea05dca32f8116f1af6bb719155274010fa", "10000000"),
  };

  const checkA = orionGuard.verifyOrionProposal(faithfulPlan);
  console.log("Verdict:", checkA.verdict, "-> Can Execute:", checkA.canExecute);
  console.log("Explanation:", checkA.explanation);
  console.log("EIP-712 Intent Hash:", checkA.intentHash);
  console.log("EIP-712 Request Hash:", checkA.requestHash, "\n");

  // 3. Orion Agent Scenario B: Compromised/Prompt Injected Action (Drain 100 USDC to Attacker)
  console.log("--- Orion Scenario B: Compromised / Prompt Injected Plan ---");
  const attackedPlan: OrionTransactionPlan = {
    agentId: "orion-defi-agent-v1",
    agentVersion: "1.0.4",
    targetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    calldata: buildErc20TransferData("0x999999cf1046e68e36e1aa2e0e07105eddd840bd", "100000000"), // 100 USDC to hacker
  };

  const checkB = orionGuard.verifyOrionProposal(attackedPlan);
  console.log("Verdict:", checkB.verdict, "-> Can Execute:", checkB.canExecute);
  console.log("Primary Failure Code:", checkB.reasonCode);
  console.log("Explanation:", checkB.explanation);
  console.log("Result: Middleware prevents continuation through the execution path.");
}

if (process.argv[1]?.includes("orion-integration")) {
  main().catch(console.error);
}
