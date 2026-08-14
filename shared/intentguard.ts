import { z } from "zod";

export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_MAINNET_CHAIN_ID_HEX = "0x2105";
export const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Expected an EVM address");
export const transactionHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Expected a 32-byte transaction hash");

export const structuredIntentSchema = z.object({
  chain: z.literal("base"),
  action: z.enum(["swap", "transfer"]),
  inputToken: z.literal("USDC"),
  outputToken: z.enum(["ETH", "USDC"]).nullable(),
  maxSpendUsdc: z.number().positive().finite().max(1_000_000),
  maxSlippagePercent: z.number().positive().finite().max(50).nullable(),
  prohibitUnlimitedApproval: z.boolean(),
  recipient: addressSchema.nullable(),
  sourceText: z.string().min(1).max(600),
});

export type StructuredIntent = z.infer<typeof structuredIntentSchema>;

export type EvidenceState = "verified" | "failed" | "unavailable";
export type VerificationVerdict = "MATCH" | "MISMATCH" | "UNVERIFIABLE";

export type EvidenceItem = {
  id: string;
  label: string;
  state: EvidenceState;
  detail: string;
  source: "Base RPC" | "Decoded calldata" | "Transaction receipt" | "Deterministic policy";
};

export type AgentTraceStep = {
  id: string;
  label: string;
  state: "completed" | "blocked" | "unavailable";
  detail: string;
};

export type VerificationResult = {
  receiptId: string;
  verdict: VerificationVerdict;
  summary: string;
  evidence: EvidenceItem[];
  passedChecks: number;
  failedChecks: number;
  unavailableChecks: number;
  observedAt: string;
};
