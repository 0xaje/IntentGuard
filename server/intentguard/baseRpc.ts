import { z } from "zod";
import { BASE_MAINNET_CHAIN_ID_HEX, BASE_USDC_ADDRESS, transactionHashSchema } from "@shared/intentguard";

const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";
const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO = BigInt(0);
const TWO = BigInt(2);
const USDC_SCALE = BigInt(1_000_000);
const ETH_SCALE = BigInt("1000000000000000000");
const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);

const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/);
const quantitySchema = z.string().regex(/^0x[0-9a-fA-F]+$/);
const rpcLogSchema = z.object({
  address: z.string(),
  data: hexSchema,
  topics: z.array(hexSchema),
  transactionHash: z.string(),
}).passthrough();

const rpcTransactionSchema = z.object({
  hash: z.string(),
  from: z.string(),
  to: z.string().nullable(),
  input: hexSchema,
  value: quantitySchema,
  blockNumber: quantitySchema.nullable(),
}).passthrough();

const rpcReceiptSchema = z.object({
  status: quantitySchema,
  blockNumber: quantitySchema,
  logs: z.array(rpcLogSchema),
}).passthrough();

type DecodedCallKind = "approve" | "transfer" | "transferFrom" | "unknown";

export type DecodedCall = {
  kind: DecodedCallKind;
  selector: string | null;
  token: "USDC" | null;
  amountRaw: string | null;
  recipient: string | null;
  spender: string | null;
};

export type TransactionInspection = {
  transactionHash: string;
  networkChainId: string;
  transaction: {
    from: string;
    to: string | null;
    valueEth: string;
    blockNumber: string | null;
  } | null;
  receipt: {
    state: "success" | "failed" | "pending" | "missing";
    blockNumber: string | null;
  };
  decoded: DecodedCall;
  observations: {
    approvals: Array<{ owner: string | null; spender: string | null; amountRaw: string; unlimited: boolean }>;
    transfers: Array<{ from: string | null; to: string | null; amountRaw: string }>;
    spentUsdcRaw: string | null;
  };
};

export class BaseRpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaseRpcError";
  }
}

function normalizeAddress(value: string | null) {
  return value?.toLowerCase() ?? null;
}

function decodeAddressWord(word: string) {
  return `0x${word.slice(-40)}`.toLowerCase();
}

function getWord(input: string, index: number) {
  const body = input.slice(10);
  const start = index * 64;
  const word = body.slice(start, start + 64);
  return word.length === 64 ? word : null;
}

function toUsdcAmount(raw: bigint) {
  const whole = raw / USDC_SCALE;
  const fraction = raw % USDC_SCALE;
  if (fraction === ZERO) return whole.toString();
  return `${whole}.${fraction.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

function toEthAmount(raw: bigint) {
  const whole = raw / ETH_SCALE;
  const fraction = raw % ETH_SCALE;
  if (fraction === ZERO) return whole.toString();
  return `${whole}.${fraction.toString().padStart(18, "0").replace(/0+$/, "")}`;
}

function decodeUsdcCall(to: string | null, input: string): DecodedCall {
  if (normalizeAddress(to) !== BASE_USDC_ADDRESS || input.length < 10) {
    return { kind: "unknown", selector: input.length >= 10 ? input.slice(0, 10).toLowerCase() : null, token: null, amountRaw: null, recipient: null, spender: null };
  }

  const selector = input.slice(0, 10).toLowerCase();
  const first = getWord(input, 0);
  const second = getWord(input, 1);
  const third = getWord(input, 2);

  if (selector === "0x095ea7b3" && first && second) {
    return {
      kind: "approve",
      selector,
      token: "USDC",
      amountRaw: BigInt(`0x${second}`).toString(),
      recipient: null,
      spender: decodeAddressWord(first),
    };
  }

  if (selector === "0xa9059cbb" && first && second) {
    return {
      kind: "transfer",
      selector,
      token: "USDC",
      amountRaw: BigInt(`0x${second}`).toString(),
      recipient: decodeAddressWord(first),
      spender: null,
    };
  }

  if (selector === "0x23b872dd" && second && third) {
    return {
      kind: "transferFrom",
      selector,
      token: "USDC",
      amountRaw: BigInt(`0x${third}`).toString(),
      recipient: decodeAddressWord(second),
      spender: null,
    };
  }

  return { kind: "unknown", selector, token: "USDC", amountRaw: null, recipient: null, spender: null };
}

function topicAddress(topic: string | undefined) {
  if (!topic || topic.length !== 66) return null;
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function parseUsdcObservations(logs: z.infer<typeof rpcLogSchema>[], transactionFrom: string | null) {
  const approvals: TransactionInspection["observations"]["approvals"] = [];
  const transfers: TransactionInspection["observations"]["transfers"] = [];
  let spent = ZERO;
  const normalizedFrom = normalizeAddress(transactionFrom);

  for (const log of logs) {
    if (normalizeAddress(log.address) !== BASE_USDC_ADDRESS || log.topics.length < 3) continue;
    const topic = log.topics[0]?.toLowerCase();
    const amountRaw = BigInt(log.data).toString();

    if (topic === APPROVAL_TOPIC) {
      const raw = BigInt(log.data);
      approvals.push({
        owner: topicAddress(log.topics[1]),
        spender: topicAddress(log.topics[2]),
        amountRaw,
        unlimited: raw >= MAX_UINT256 / TWO,
      });
    }

    if (topic === TRANSFER_TOPIC) {
      const from = topicAddress(log.topics[1]);
      const to = topicAddress(log.topics[2]);
      transfers.push({ from, to, amountRaw });
      if (from && normalizedFrom && from === normalizedFrom) {
        spent += BigInt(log.data);
      }
    }
  }

  return { approvals, transfers, spentUsdcRaw: spent > ZERO ? spent.toString() : null };
}

async function rpcCall<T>(method: string, params: unknown[], schema: z.ZodType<T>): Promise<T> {
  const rpcUrl = process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL;
  let response: Response;
  try {
    response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `${Date.now()}-${method}`, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new BaseRpcError("Unable to reach the configured Base RPC endpoint.");
  }

  if (!response.ok) {
    throw new BaseRpcError(`Base RPC returned HTTP ${response.status}.`);
  }

  const body: unknown = await response.json();
  if (!body || typeof body !== "object") {
    throw new BaseRpcError("Base RPC returned an invalid response body.");
  }

  const payload = body as { result?: unknown; error?: { message?: string } };
  if (payload.error) {
    throw new BaseRpcError(payload.error.message || "Base RPC returned an error.");
  }

  try {
    return schema.parse(payload.result);
  } catch {
    throw new BaseRpcError(`Base RPC returned an invalid ${method} result.`);
  }
}

export async function getBaseHealth() {
  const chainId = await rpcCall("eth_chainId", [], quantitySchema);
  return { reachable: chainId.toLowerCase() === BASE_MAINNET_CHAIN_ID_HEX, chainId };
}

export async function inspectBaseTransaction(transactionHashInput: string): Promise<TransactionInspection> {
  const transactionHash = transactionHashSchema.parse(transactionHashInput).toLowerCase();
  const [networkChainId, transaction, receipt] = await Promise.all([
    rpcCall("eth_chainId", [], quantitySchema),
    rpcCall("eth_getTransactionByHash", [transactionHash], rpcTransactionSchema.nullable()),
    rpcCall("eth_getTransactionReceipt", [transactionHash], rpcReceiptSchema.nullable()),
  ]);

  if (!transaction) {
    return {
      transactionHash,
      networkChainId,
      transaction: null,
      receipt: { state: "missing", blockNumber: null },
      decoded: { kind: "unknown", selector: null, token: null, amountRaw: null, recipient: null, spender: null },
      observations: { approvals: [], transfers: [], spentUsdcRaw: null },
    };
  }

  const decoded = decodeUsdcCall(transaction.to, transaction.input);
  const observations = parseUsdcObservations(receipt?.logs ?? [], transaction.from);
  if (decoded.kind === "approve" && decoded.amountRaw) {
    const amount = BigInt(decoded.amountRaw);
    observations.approvals.unshift({
      owner: transaction.from.toLowerCase(),
      spender: decoded.spender,
      amountRaw: decoded.amountRaw,
      unlimited: amount >= MAX_UINT256 / TWO,
    });
  }

  const receiptState = !receipt
    ? "pending"
    : receipt.status.toLowerCase() === "0x1"
      ? "success"
      : "failed";

  return {
    transactionHash,
    networkChainId,
    transaction: {
      from: transaction.from.toLowerCase(),
      to: normalizeAddress(transaction.to),
      valueEth: toEthAmount(BigInt(transaction.value)),
      blockNumber: transaction.blockNumber,
    },
    receipt: { state: receiptState, blockNumber: receipt?.blockNumber ?? null },
    decoded,
    observations,
  };
}

export function displayUsdc(raw: string | null) {
  return raw ? toUsdcAmount(BigInt(raw)) : null;
}
