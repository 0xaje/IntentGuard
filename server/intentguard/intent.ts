import { structuredIntentSchema, type StructuredIntent } from "@shared/intentguard";

const UNSUPPORTED_CHAINS = /\b(ethereum|mainnet|arbitrum|optimism|polygon|solana|avalanche|bnb|bitcoin)\b/i;
const BASE_CHAIN = /\bbase\b/i;
const UNLIMITED_APPROVAL_PROHIBITED = /(?:don't|do not|never|no)\s+(?:allow\s+)?unlimited\s+approvals?|unlimited\s+approvals?\s*(?:are\s*)?(?:prohibited|blocked|forbidden)/i;

export class IntentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentParseError";
  }
}

function normalizeInput(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function parseAmount(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new IntentParseError("The USDC amount must be a positive number.");
  }
  return amount;
}

function assertBaseOnly(text: string) {
  if (!BASE_CHAIN.test(text)) {
    throw new IntentParseError("IntentGuard v0.1 is Base-only. State Base explicitly in the requested action.");
  }
  if (UNSUPPORTED_CHAINS.test(text) && !BASE_CHAIN.test(text)) {
    throw new IntentParseError("IntentGuard v0.1 supports Base only. Remove the unsupported network or explicitly request Base.");
  }
}

function parseSlippage(text: string) {
  const match = text.match(/(?:maximum|max)\s+slippage\s*(?:of|:|is)?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (!match) return null;

  const slippage = Number(match[1]);
  if (!Number.isFinite(slippage) || slippage <= 0 || slippage > 50) {
    throw new IntentParseError("Maximum slippage must be greater than 0% and no more than 50%.");
  }
  return slippage;
}

export function parseStructuredIntent(sourceText: string): StructuredIntent {
  const text = normalizeInput(sourceText);
  if (text.length < 8) {
    throw new IntentParseError("Describe the Base action in enough detail to extract explicit constraints.");
  }

  assertBaseOnly(text);

  const transferMatch = text.match(/\b(?:send|transfer)\s+\$?(\d+(?:\.\d+)?)\s*usdc\s+to\s+(0x[a-fA-F0-9]{40})\b/i);
  if (transferMatch) {
    return structuredIntentSchema.parse({
      chain: "base",
      action: "transfer",
      inputToken: "USDC",
      outputToken: "USDC",
      maxSpendUsdc: parseAmount(transferMatch[1]),
      maxSlippagePercent: null,
      prohibitUnlimitedApproval: UNLIMITED_APPROVAL_PROHIBITED.test(text),
      recipient: transferMatch[2].toLowerCase(),
      sourceText: text,
    });
  }

  const swapMatch = text.match(/\bswap\s+\$?(\d+(?:\.\d+)?)\s*usdc\s+(?:for|to)\s+(eth|weth)\b/i);
  if (swapMatch) {
    return structuredIntentSchema.parse({
      chain: "base",
      action: "swap",
      inputToken: "USDC",
      outputToken: "ETH",
      maxSpendUsdc: parseAmount(swapMatch[1]),
      maxSlippagePercent: parseSlippage(text),
      prohibitUnlimitedApproval: UNLIMITED_APPROVAL_PROHIBITED.test(text),
      recipient: null,
      sourceText: text,
    });
  }

  throw new IntentParseError(
    "IntentGuard v0.1 currently supports Base USDC→ETH swaps and Base USDC transfers to an explicit EVM address."
  );
}
