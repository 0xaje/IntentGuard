import { z } from "zod";
import {
  BASE_MAINNET_CHAIN_ID_HEX,
  BASE_USDC_ADDRESS,
  UNISWAP_V3_EXACT_INPUT_SINGLE_SELECTOR,
  UNISWAP_V3_QUOTER_V2_ADDRESS,
  UNISWAP_V3_SWAP_ROUTER_02_ADDRESS,
  transactionHashSchema,
} from "@shared/intentguard";

const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";
const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const QUOTER_EXACT_INPUT_SINGLE_SELECTOR = "0xc6a5026a";
const ERC20_SYMBOL_SELECTOR = "0x95d89b41";
const ERC20_DECIMALS_SELECTOR = "0x313ce567";
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

type DecodedCallKind = "approve" | "transfer" | "transferFrom" | "uniswap-v3-exact-input-single" | "unknown";

export type RouterSwap = {
  protocol: "uniswap-v3-swap-router-02";
  tokenIn: string;
  tokenOut: string;
  fee: number;
  recipient: string;
  amountInRaw: string;
  amountOutMinimumRaw: string;
  sqrtPriceLimitX96Raw: string;
};

export type TokenMetadata = {
  address: string;
  state: "available" | "unavailable";
  symbol: string | null;
  decimals: number | null;
  detail: string;
};

export type DecodedCall = {
  kind: DecodedCallKind;
  selector: string | null;
  token: "USDC" | null;
  amountRaw: string | null;
  recipient: string | null;
  spender: string | null;
  routerSwap: RouterSwap | null;
};

export type RouterSimulation = {
  state: "not-applicable" | "available" | "unavailable";
  protocol: "uniswap-v3-quoter-v2" | null;
  contractAddress: string | null;
  method: "eth_call" | null;
  selector: string | null;
  amountOutRaw: string | null;
  sqrtPriceX96AfterRaw: string | null;
  initializedTicksCrossed: number | null;
  gasEstimate: string | null;
  blockTag: "latest" | null;
  detail: string;
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
  simulation: RouterSimulation;
  tokenMetadata: {
    input: TokenMetadata | null;
    output: TokenMetadata | null;
  };
  observations: {
    approvals: Array<{ owner: string | null; spender: string | null; amountRaw: string; unlimited: boolean }>;
    transfers: Array<{ from: string | null; to: string | null; amountRaw: string }>;
    spentUsdcRaw: string | null;
  };
  raw: {
    transaction: { from: string; to: string | null; input: string; value: string; blockNumber: string | null } | null;
    receipt: { status: string; blockNumber: string; logs: Array<{ address: string; data: string; topics: string[] }> } | null;
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

function encodeAddressWord(address: string) {
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function encodeUintWord(value: string | number) {
  const decimal = typeof value === "number" ? BigInt(value) : BigInt(value);
  return decimal.toString(16).padStart(64, "0");
}

export function decodeErc20SymbolResponse(response: string) {
  const body = response.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(body) || body.length < 64) throw new BaseRpcError("ERC-20 symbol response was malformed.");

  let payload = body;
  if (body.length > 64) {
    const offset = Number(BigInt(`0x${body.slice(0, 64)}`));
    const offsetIndex = offset * 2;
    if (!Number.isSafeInteger(offsetIndex) || body.length < offsetIndex + 64) throw new BaseRpcError("ERC-20 symbol response used an invalid ABI offset.");
    const stringLength = Number(BigInt(`0x${body.slice(offsetIndex, offsetIndex + 64)}`));
    const dataStart = offsetIndex + 64;
    const dataEnd = dataStart + stringLength * 2;
    if (!Number.isSafeInteger(dataEnd) || body.length < dataEnd) throw new BaseRpcError("ERC-20 symbol response used an invalid ABI length.");
    payload = body.slice(dataStart, dataEnd);
  }

  const symbol = Buffer.from(payload, "hex").toString("utf8").replace(/\0/g, "").trim();
  if (!symbol || symbol.length > 48 || /[^\x20-\x7E]/.test(symbol)) throw new BaseRpcError("ERC-20 symbol response was not a display-safe string.");
  return symbol;
}

export function decodeErc20DecimalsResponse(response: string) {
  const body = response.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(body) || body.length < 64) throw new BaseRpcError("ERC-20 decimals response was malformed.");
  const decimals = Number(BigInt(`0x${body.slice(0, 64)}`));
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 36) throw new BaseRpcError("ERC-20 decimals value was outside the supported display range.");
  return decimals;
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

function unknownCall(input: string): DecodedCall {
  return { kind: "unknown", selector: input.length >= 10 ? input.slice(0, 10).toLowerCase() : null, token: null, amountRaw: null, recipient: null, spender: null, routerSwap: null };
}

function decodeUsdcCall(to: string | null, input: string): DecodedCall {
  if (normalizeAddress(to) !== BASE_USDC_ADDRESS || input.length < 10) return unknownCall(input);

  const selector = input.slice(0, 10).toLowerCase();
  const first = getWord(input, 0);
  const second = getWord(input, 1);
  const third = getWord(input, 2);

  if (selector === "0x095ea7b3" && first && second) {
    return { kind: "approve", selector, token: "USDC", amountRaw: BigInt(`0x${second}`).toString(), recipient: null, spender: decodeAddressWord(first), routerSwap: null };
  }
  if (selector === "0xa9059cbb" && first && second) {
    return { kind: "transfer", selector, token: "USDC", amountRaw: BigInt(`0x${second}`).toString(), recipient: decodeAddressWord(first), spender: null, routerSwap: null };
  }
  if (selector === "0x23b872dd" && second && third) {
    return { kind: "transferFrom", selector, token: "USDC", amountRaw: BigInt(`0x${third}`).toString(), recipient: decodeAddressWord(second), spender: null, routerSwap: null };
  }
  return { kind: "unknown", selector, token: "USDC", amountRaw: null, recipient: null, spender: null, routerSwap: null };
}

function decodeAllowlistedRouterCall(to: string | null, input: string): DecodedCall | null {
  if (normalizeAddress(to) !== UNISWAP_V3_SWAP_ROUTER_02_ADDRESS) return null;
  if (input.slice(0, 10).toLowerCase() !== UNISWAP_V3_EXACT_INPUT_SINGLE_SELECTOR || input.length !== 10 + 64 * 7) return unknownCall(input);

  const tokenIn = getWord(input, 0);
  const tokenOut = getWord(input, 1);
  const fee = getWord(input, 2);
  const recipient = getWord(input, 3);
  const amountIn = getWord(input, 4);
  const amountOutMinimum = getWord(input, 5);
  const sqrtPriceLimitX96 = getWord(input, 6);
  if (!tokenIn || !tokenOut || !fee || !recipient || !amountIn || !amountOutMinimum || !sqrtPriceLimitX96) return unknownCall(input);

  const feeValue = BigInt(`0x${fee}`);
  if (feeValue > BigInt(16_777_215)) return unknownCall(input);
  const normalizedTokenIn = decodeAddressWord(tokenIn);
  const normalizedTokenOut = decodeAddressWord(tokenOut);
  const amountInRaw = BigInt(`0x${amountIn}`).toString();

  return {
    kind: "uniswap-v3-exact-input-single",
    selector: UNISWAP_V3_EXACT_INPUT_SINGLE_SELECTOR,
    token: normalizedTokenIn === BASE_USDC_ADDRESS ? "USDC" : null,
    amountRaw: amountInRaw,
    recipient: decodeAddressWord(recipient),
    spender: null,
    routerSwap: {
      protocol: "uniswap-v3-swap-router-02",
      tokenIn: normalizedTokenIn,
      tokenOut: normalizedTokenOut,
      fee: Number(feeValue),
      recipient: decodeAddressWord(recipient),
      amountInRaw,
      amountOutMinimumRaw: BigInt(`0x${amountOutMinimum}`).toString(),
      sqrtPriceLimitX96Raw: BigInt(`0x${sqrtPriceLimitX96}`).toString(),
    },
  };
}

export function decodeBaseTransactionCall(to: string | null, input: string): DecodedCall {
  return decodeAllowlistedRouterCall(to, input) ?? decodeUsdcCall(to, input);
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
      approvals.push({ owner: topicAddress(log.topics[1]), spender: topicAddress(log.topics[2]), amountRaw, unlimited: raw >= MAX_UINT256 / TWO });
    }
    if (topic === TRANSFER_TOPIC) {
      const from = topicAddress(log.topics[1]);
      const to = topicAddress(log.topics[2]);
      transfers.push({ from, to, amountRaw });
      if (from && normalizedFrom && from === normalizedFrom) spent += BigInt(log.data);
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
  if (!response.ok) throw new BaseRpcError(`Base RPC returned HTTP ${response.status}.`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object") throw new BaseRpcError("Base RPC returned an invalid response body.");
  const payload = body as { result?: unknown; error?: { message?: string } };
  if (payload.error) throw new BaseRpcError(payload.error.message || "Base RPC returned an error.");
  try {
    return schema.parse(payload.result);
  } catch {
    throw new BaseRpcError(`Base RPC returned an invalid ${method} result.`);
  }
}

function noSimulation(detail: string): RouterSimulation {
  return { state: "not-applicable", protocol: null, contractAddress: null, method: null, selector: null, amountOutRaw: null, sqrtPriceX96AfterRaw: null, initializedTicksCrossed: null, gasEstimate: null, blockTag: null, detail };
}

async function resolveTokenMetadata(address: string): Promise<TokenMetadata> {
  try {
    const [symbolResponse, decimalsResponse] = await Promise.all([
      rpcCall("eth_call", [{ to: address, data: ERC20_SYMBOL_SELECTOR }, "latest"], hexSchema),
      rpcCall("eth_call", [{ to: address, data: ERC20_DECIMALS_SELECTOR }, "latest"], hexSchema),
    ]);
    return {
      address,
      state: "available",
      symbol: decodeErc20SymbolResponse(symbolResponse),
      decimals: decodeErc20DecimalsResponse(decimalsResponse),
      detail: "Read-only ERC-20 symbol and decimals calls completed at the latest Base state.",
    };
  } catch (error) {
    const message = error instanceof BaseRpcError ? error.message : "The read-only ERC-20 metadata calls could not be completed.";
    return { address, state: "unavailable", symbol: null, decimals: null, detail: message };
  }
}

async function resolveRouterTokenMetadata(decoded: DecodedCall): Promise<TransactionInspection["tokenMetadata"]> {
  if (!decoded.routerSwap) return { input: null, output: null };
  const [input, output] = await Promise.all([
    resolveTokenMetadata(decoded.routerSwap.tokenIn),
    resolveTokenMetadata(decoded.routerSwap.tokenOut),
  ]);
  return { input, output };
}

function decodeQuoterResponse(response: string): Omit<RouterSimulation, "state" | "protocol" | "contractAddress" | "method" | "selector" | "blockTag" | "detail"> {
  const body = response.slice(2);
  if (body.length < 64 * 4) throw new BaseRpcError("QuoterV2 returned incomplete quote data.");
  const word = (index: number) => body.slice(index * 64, (index + 1) * 64);
  return {
    amountOutRaw: BigInt(`0x${word(0)}`).toString(),
    sqrtPriceX96AfterRaw: BigInt(`0x${word(1)}`).toString(),
    initializedTicksCrossed: Number(BigInt(`0x${word(2)}`)),
    gasEstimate: BigInt(`0x${word(3)}`).toString(),
  };
}

async function quoteAllowlistedRouterSwap(decoded: DecodedCall): Promise<RouterSimulation> {
  const swap = decoded.routerSwap;
  if (!swap) return noSimulation("No allowlisted exactInputSingle swap was decoded, so no router quote was requested.");
  const calldata = `${QUOTER_EXACT_INPUT_SINGLE_SELECTOR}${encodeAddressWord(swap.tokenIn)}${encodeAddressWord(swap.tokenOut)}${encodeUintWord(swap.amountInRaw)}${encodeUintWord(swap.fee)}${encodeUintWord(swap.sqrtPriceLimitX96Raw)}`;
  try {
    const response = await rpcCall("eth_call", [{ to: UNISWAP_V3_QUOTER_V2_ADDRESS, data: calldata }, "latest"], hexSchema);
    const quote = decodeQuoterResponse(response);
    return { state: "available", protocol: "uniswap-v3-quoter-v2", contractAddress: UNISWAP_V3_QUOTER_V2_ADDRESS, method: "eth_call", selector: QUOTER_EXACT_INPUT_SINGLE_SELECTOR, ...quote, blockTag: "latest", detail: "Read-only QuoterV2 eth_call completed at the latest Base state. This is an estimate, not mined execution evidence." };
  } catch (error) {
    const message = error instanceof BaseRpcError ? error.message : "The read-only QuoterV2 call could not be completed.";
    return { state: "unavailable", protocol: "uniswap-v3-quoter-v2", contractAddress: UNISWAP_V3_QUOTER_V2_ADDRESS, method: "eth_call", selector: QUOTER_EXACT_INPUT_SINGLE_SELECTOR, amountOutRaw: null, sqrtPriceX96AfterRaw: null, initializedTicksCrossed: null, gasEstimate: null, blockTag: "latest", detail: message };
  }
}

export async function getBaseHealth() {
  const chainId = await rpcCall("eth_chainId", [], quantitySchema);
  return { reachable: chainId.toLowerCase() === BASE_MAINNET_CHAIN_ID_HEX, chainId };
}

/**
 * inspectBaseTransaction: Real-time Base RPC inspection, calldata decoding,
 * receipt inspection, event analysis, and supported read-only quote evidence.
 *
 * CRITICAL DISTINCTION:
 * - TRANSACTION EVIDENCE: Observable on-chain data (status, gas, mined logs, ERC-20 transfers).
 * - CURRENT QUOTE: Point-in-time output estimate queried via read-only QuoterV2 at the current block state.
 * - HISTORICAL SIMULATION: Not performed. We do not claim archive-state debug_trace re-execution.
 */
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
      decoded: unknownCall(""),
      simulation: noSimulation("No transaction was found, so no router quote was requested."),
      tokenMetadata: { input: null, output: null },
      observations: { approvals: [], transfers: [], spentUsdcRaw: null },
      raw: { transaction: null, receipt: null },
    };
  }

  const decoded = decodeBaseTransactionCall(transaction.to, transaction.input);
  const observations = parseUsdcObservations(receipt?.logs ?? [], transaction.from);
  if (decoded.kind === "approve" && decoded.amountRaw) {
    const amount = BigInt(decoded.amountRaw);
    observations.approvals.unshift({ owner: transaction.from.toLowerCase(), spender: decoded.spender, amountRaw: decoded.amountRaw, unlimited: amount >= MAX_UINT256 / TWO });
  }
  const receiptState = !receipt ? "pending" : receipt.status.toLowerCase() === "0x1" ? "success" : "failed";
  const [simulation, tokenMetadata] = await Promise.all([
    quoteAllowlistedRouterSwap(decoded),
    resolveRouterTokenMetadata(decoded),
  ]);

  return {
    transactionHash,
    networkChainId,
    transaction: { from: transaction.from.toLowerCase(), to: normalizeAddress(transaction.to), valueEth: toEthAmount(BigInt(transaction.value)), blockNumber: transaction.blockNumber },
    receipt: { state: receiptState, blockNumber: receipt?.blockNumber ?? null },
    decoded,
    simulation,
    tokenMetadata,
    observations,
    raw: {
      transaction: { from: transaction.from.toLowerCase(), to: normalizeAddress(transaction.to), input: transaction.input.toLowerCase(), value: transaction.value, blockNumber: transaction.blockNumber },
      receipt: receipt ? { status: receipt.status, blockNumber: receipt.blockNumber, logs: receipt.logs.map((log) => ({ address: log.address.toLowerCase(), data: log.data.toLowerCase(), topics: log.topics.map((topic) => topic.toLowerCase()) })) } : null,
    },
  };
}

export function displayUsdc(raw: string | null) {
  return raw ? toUsdcAmount(BigInt(raw)) : null;
}

export function displayEth(raw: string | null) {
  return raw ? toEthAmount(BigInt(raw)) : null;
}
