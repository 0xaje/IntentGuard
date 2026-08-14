import { describe, expect, it } from "vitest";
import { decodeErc20DecimalsResponse, decodeErc20SymbolResponse } from "./baseRpc";

describe("ERC-20 metadata decoders", () => {
  it("decodes a standard ABI string symbol", () => {
    const payload = `0x${"0".repeat(62)}20${"0".repeat(63)}4${"55534443"}${"0".repeat(56)}`;
    expect(decodeErc20SymbolResponse(payload)).toBe("USDC");
  });

  it("decodes a bytes32-compatible symbol response", () => {
    const payload = `0x57455448${"0".repeat(56)}`;
    expect(decodeErc20SymbolResponse(payload)).toBe("WETH");
  });

  it("decodes a bounded ERC-20 decimals response", () => {
    expect(decodeErc20DecimalsResponse(`0x${"0".repeat(62)}06`)).toBe(6);
  });
});
