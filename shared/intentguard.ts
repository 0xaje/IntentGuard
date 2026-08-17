import { z } from "zod";

export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_MAINNET_CHAIN_ID_HEX = "0x2105";
export const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
export const UNISWAP_V3_SWAP_ROUTER_02_ADDRESS = "0x2626664c2603336e57b271c5c0b26f421741e481";
export const UNISWAP_V3_QUOTER_V2_ADDRESS = "0x3d4e44eb1374240ce5f1b871ab261cd16335b76a";
export const UNISWAP_V3_EXACT_INPUT_SINGLE_SELECTOR = "0x04e45aaf";

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
  source: "Base RPC" | "Decoded calldata" | "Transaction receipt" | "Read-only QuoterV2" | "Deterministic policy";
  blockNumber?: number | null;
  blockHash?: string | null;
};

export type AgentTraceStep = {
  id: string;
  label: string;
  state: "completed" | "blocked" | "unavailable";
  detail: string;
};

export type EvidenceProvenance = {
  source: string;
  blockNumber: number | null;
  blockHash: string | null;
  transactionHash: string | null;
  receiptStatus: "mined_success" | "mined_reverted" | "pending" | "missing" | null;
  contractAddress: string | null;
  decoder: string;
  decoderVersion: number;
  engineVersion: number;
  evidenceHash: string;
};

export type VerificationResult = {
  receiptId: string;
  verdict: VerificationVerdict;
  summary: string;
  evidence: EvidenceItem[];
  provenance: EvidenceProvenance;
  passedChecks: number;
  failedChecks: number;
  unavailableChecks: number;
  observedAt: string;
};
