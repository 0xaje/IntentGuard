import { getAddress, isAddress, keccak256, toUtf8Bytes } from "ethers";
import type { Address, Hex } from "./types";

export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite numbers are not canonicalizable");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString(10));

  if (value === undefined) return "null";

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).filter((key) => object[key] !== undefined).sort();
    const fields = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`);
    return `{${fields.join(",")}}`;
  }

  throw new Error(`Unsupported canonicalization type: ${typeof value}`);
}

export function hashCanonical(value: unknown): Hex {
  return keccak256(toUtf8Bytes(canonicalize(value))) as Hex;
}

export function normalizeAddress(address: Address): Address {
  if (!isAddress(address)) throw new Error(`Invalid address: ${address}`);
  return getAddress(address).toLowerCase();
}

export function normalizeOptionalAddress(address: Address | undefined): Address | undefined {
  return address === undefined ? undefined : normalizeAddress(address);
}

export function normalizeHex(value: string): Hex {
  if (!/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error(`Invalid hexadecimal value: ${value}`);
  }
  return value.toLowerCase() as Hex;
}

export function decimalString(value: unknown, field: string): string {
  const stringValue = typeof value === "bigint" ? value.toString(10) : String(value);
  if (!/^(0|[1-9][0-9]*)$/.test(stringValue)) {
    throw new Error(`${field} must be a non-negative decimal integer string`);
  }
  return stringValue;
}

export function isZeroAddress(address: Address | undefined): boolean {
  return address?.toLowerCase() === "0x0000000000000000000000000000000000000000";
}
