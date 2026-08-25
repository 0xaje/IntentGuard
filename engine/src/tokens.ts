import { normalizeAddress } from "./canonical";
import type { Address } from "./types";

export interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  isKnown?: boolean;
}

/**
 * Curated registry of canonical and high-volume Base Mainnet tokens.
 * Used for instant zero-latency lookups before falling back to on-chain RPC resolution.
 */
export const KNOWN_BASE_TOKENS: Record<string, TokenInfo> = {
  // Native / Wrapped
  "0x4200000000000000000000000000000000000006": {
    address: "0x4200000000000000000000000000000000000006",
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    isKnown: true,
  },
  // Stables
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    isKnown: true,
  },
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": {
    address: "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
    name: "USD Base Coin",
    symbol: "USDbC",
    decimals: 6,
    isKnown: true,
  },
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": {
    address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
    name: "Dai Stablecoin",
    symbol: "DAI",
    decimals: 18,
    isKnown: true,
  },
  // BTC on Base
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": {
    address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    name: "Coinbase Wrapped BTC",
    symbol: "cbBTC",
    decimals: 8,
    isKnown: true,
  },
  // DeFi & AI Agent Ecosystem Tokens
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631": {
    address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    name: "Aerodrome",
    symbol: "AERO",
    decimals: 18,
    isKnown: true,
  },
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": {
    address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
    name: "Virtual Protocol",
    symbol: "VIRTUAL",
    decimals: 18,
    isKnown: true,
  },
  "0x4ed4e862860be51a91bd9ffdac5b20bff61f8089": {
    address: "0x4ed4e862860be51a91bd9ffdac5b20bff61f8089",
    name: "Degen",
    symbol: "DEGEN",
    decimals: 18,
    isKnown: true,
  },
  "0x532f27101965dd16442e59d40670faf5ebb142e4": {
    address: "0x532f27101965dd16442e59d40670faf5ebb142e4",
    name: "Brett",
    symbol: "BRETT",
    decimals: 18,
    isKnown: true,
  },
};

/**
 * Synchronously retrieves known token info from cache if available.
 */
export function getKnownToken(addressOrSymbol: string): TokenInfo | undefined {
  const normalized = addressOrSymbol.toLowerCase();
  if (KNOWN_BASE_TOKENS[normalized]) {
    return KNOWN_BASE_TOKENS[normalized];
  }
  return Object.values(KNOWN_BASE_TOKENS).find(
    (t) => t.symbol.toLowerCase() === normalized,
  );
}

/**
 * Format raw atomic token amount to human-readable string based on decimals.
 * Pure arithmetic implementation avoiding floating point precision loss.
 */
export function formatTokenUnits(rawAmount: bigint | string, decimals: number = 18): string {
  const raw = BigInt(rawAmount).toString(10);
  if (decimals === 0) return raw;

  const negative = raw.startsWith("-");
  const abs = negative ? raw.slice(1) : raw;

  const padded = abs.padStart(decimals + 1, "0");
  const integerPart = padded.slice(0, padded.length - decimals);
  let fractionalPart = padded.slice(padded.length - decimals);

  // Trim trailing zeroes
  fractionalPart = fractionalPart.replace(/0+$/, "");

  const result = fractionalPart.length > 0 ? `${integerPart}.${fractionalPart}` : integerPart;
  return negative ? `-${result}` : result;
}

/**
 * Parse a human-readable decimal amount (e.g. "1.5") into raw token units.
 */
export function parseTokenUnits(humanAmount: string | number, decimals: number = 18): bigint {
  const str = String(humanAmount).trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(str)) {
    throw new Error(`Invalid decimal amount format: "${humanAmount}"`);
  }

  const [integerPart, fractionalPart = ""] = str.split(".");
  const paddedFraction = fractionalPart.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(integerPart + paddedFraction);
}

/**
 * Selectors for ERC-20 standard metadata methods.
 */
export const ERC20_METADATA_SELECTORS = {
  NAME: "0x06fdde03",     // name()
  SYMBOL: "0x95d89b41",   // symbol()
  DECIMALS: "0x313ce567", // decimals()
  TOTAL_SUPPLY: "0x18160ddd", // totalSupply()
} as const;

/**
 * Decode standard ABI-encoded string or bytes32 symbol/name.
 */
export function decodeErc20String(hex: string): string | null {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!raw || raw.length === 0) return null;

  try {
    // Check if dynamic string: offset at word 0, length at word 1, string data at word 2
    if (raw.length >= 128) {
      const lengthHex = raw.slice(64, 128);
      const length = parseInt(lengthHex, 16);
      if (length > 0 && length < 1000) {
        const strBytes = raw.slice(128, 128 + length * 2);
        return Buffer.from(strBytes, "hex").toString("utf8").replace(/\0/g, "").trim();
      }
    }

    // Fallback: bytes32 fixed string
    if (raw.length === 64) {
      const text = Buffer.from(raw, "hex").toString("utf8").replace(/\0/g, "").trim();
      if (text.length > 0) return text;
    }
  } catch {
    // Decoding failed
  }
  return null;
}

/**
 * Decode standard ABI-encoded uint8 decimals.
 */
export function decodeErc20Decimals(hex: string): number | null {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!raw || raw.length < 2) return null;
  try {
    const value = parseInt(raw.slice(-4), 16);
    if (!isNaN(value) && value >= 0 && value <= 36) {
      return value;
    }
  } catch {
    // Fallthrough
  }
  return null;
}
