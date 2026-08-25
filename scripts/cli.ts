#!/usr/bin/env node
/**
 * IntentGuard Developer CLI
 *
 * Usage:
 *   npx tsx scripts/cli.ts verify --action TRANSFER --token 0x8335... --to 0xb806... --amount 10000000 --calldata 0xa9059cbb...
 *   npx tsx scripts/cli.ts help
 */

import { verifyAgentAction } from "../engine/src";
import type { IntentSpec, ProposedRequest } from "../engine/src";

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}

function printHelp() {
  console.log(`
🛡️  IntentGuard CLI - Deterministic Intent Verification & Attestation

Usage:
  intentguard verify [options]
  intentguard --help

Options:
  --action     Declared action (TRANSFER, APPROVE, SWAP, PERMIT) [default: TRANSFER]
  --chain      Chain ID (8453 for Base Mainnet, 84532 for Base Sepolia) [default: 8453]
  --token      Token address (e.g. 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 for USDC)
  --recipient  Allowed recipient address (for transfers)
  --spender    Allowed spender address (for approvals)
  --max        Maximum allowed raw amount
  --to         Target contract address of proposed transaction
  --data       Hex calldata of proposed transaction (0x...)
  --value      Attached native value in wei [default: 0]

Examples:
  npx tsx scripts/cli.ts verify \\
    --action TRANSFER \\
    --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \\
    --recipient 0xb8069ea05dca32f8116f1af6bb719155274010fa \\
    --max 10000000 \\
    --to 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \\
    --data 0xa9059cbb000000000000000000000000b8069ea05dca32f8116f1af6bb719155274010fa0000000000000000000000000000000000000000000000000000000000989680
`);
}

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (args.length === 0 || parsed.help || parsed["h"]) {
    printHelp();
    return;
  }

  const action = (parsed.action?.toUpperCase() as any) ?? "TRANSFER";
  const chainId = Number(parsed.chain ?? 8453) as 8453 | 84532;
  const token = parsed.token;
  const recipient = parsed.recipient;
  const spender = parsed.spender;
  const maxRaw = parsed.max;
  const to = parsed.to ?? token;
  const data = (parsed.data as `0x${string}`) ?? "0x";
  const valueWei = parsed.value ?? "0";

  const intent: IntentSpec = {
    schemaVersion: 1,
    chainId,
    action,
    asset: token ? { address: token } : undefined,
    recipient: recipient ? { exact: recipient } : undefined,
    spender: spender ? { exact: spender } : undefined,
    spendCap: maxRaw ? { token: token ?? "0x0000000000000000000000000000000000000000", maxRaw } : undefined,
    approvalPolicy: "EXACT_ONLY",
    permitPolicy: "NOT_APPLICABLE",
    allowNativeValue: false,
    allowUnknownSelectors: false,
  };

  const request: ProposedRequest = {
    schemaVersion: 1,
    chainId,
    to,
    data,
    valueWei,
  };

  console.log("\n--- Evaluating IntentGuard Policy ---");
  const result = verifyAgentAction({ intent, request });

  console.log(`Verdict: ${result.verdict === "MATCH" ? "🟢 MATCH (Safe)" : "🔴 MISMATCH (Blocked)"}`);
  if (result.primaryReasonCode) {
    console.log(`Primary Reason Code: ${result.primaryReasonCode}`);
  }
  console.log(`Explanation: ${result.explanation}`);
  console.log(`Intent Hash: ${result.analysis.intentHash}`);
  console.log(`Request Hash: ${result.analysis.requestHash}`);
  console.log(`Evidence Hash: ${result.analysis.evidenceHash}`);

  if (!result.isSafe) {
    process.exit(1);
  }
}

if (process.argv[1]?.includes("cli")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
