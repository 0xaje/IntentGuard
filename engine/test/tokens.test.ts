import test from "node:test";
import assert from "node:assert/strict";
import {
  KNOWN_BASE_TOKENS,
  getKnownToken,
  formatTokenUnits,
  parseTokenUnits,
  decodeErc20String,
  decodeErc20Decimals,
} from "../src/tokens";

test("getKnownToken resolves canonical Base tokens by address and symbol", () => {
  const usdcByAddr = getKnownToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  assert.equal(usdcByAddr?.symbol, "USDC");
  assert.equal(usdcByAddr?.decimals, 6);

  const wethBySymbol = getKnownToken("WETH");
  assert.equal(wethBySymbol?.symbol, "WETH");
  assert.equal(wethBySymbol?.decimals, 18);

  const cbBtcBySymbol = getKnownToken("cbBTC");
  assert.equal(cbBtcBySymbol?.symbol, "cbBTC");
  assert.equal(cbBtcBySymbol?.decimals, 8);

  const aeroBySymbol = getKnownToken("AERO");
  assert.equal(aeroBySymbol?.decimals, 18);

  const virtualBySymbol = getKnownToken("VIRTUAL");
  assert.equal(virtualBySymbol?.decimals, 18);

  const unknown = getKnownToken("0x0000000000000000000000000000000000000001");
  assert.equal(unknown, undefined);
});

test("formatTokenUnits formats atomic values across different decimal precisions", () => {
  // 6 decimals (USDC)
  assert.equal(formatTokenUnits("1000000", 6), "1");
  assert.equal(formatTokenUnits("1500000", 6), "1.5");
  assert.equal(formatTokenUnits("250000", 6), "0.25");
  assert.equal(formatTokenUnits("1", 6), "0.000001");

  // 18 decimals (ETH / WETH)
  assert.equal(formatTokenUnits("1000000000000000000", 18), "1");
  assert.equal(formatTokenUnits("500000000000000000", 18), "0.5");

  // 8 decimals (cbBTC)
  assert.equal(formatTokenUnits("100000000", 8), "1");
  assert.equal(formatTokenUnits("50000000", 8), "0.5");

  // 0 decimals
  assert.equal(formatTokenUnits("123", 0), "123");
});

test("parseTokenUnits parses human decimal strings into raw bigints", () => {
  assert.equal(parseTokenUnits("1", 6), BigInt(1000000));
  assert.equal(parseTokenUnits("1.5", 6), BigInt(1500000));
  assert.equal(parseTokenUnits("0.000001", 6), BigInt(1));

  assert.equal(parseTokenUnits("1", 18), BigInt("1000000000000000000"));
  assert.equal(parseTokenUnits("0.5", 18), BigInt("500000000000000000"));

  assert.equal(parseTokenUnits("1.25", 8), BigInt(125000000));
});

test("decodeErc20Decimals decodes raw hex correctly", () => {
  assert.equal(decodeErc20Decimals("0x0000000000000000000000000000000000000000000000000000000000000006"), 6);
  assert.equal(decodeErc20Decimals("0x0000000000000000000000000000000000000000000000000000000000000012"), 18);
  assert.equal(decodeErc20Decimals("0x0000000000000000000000000000000000000000000000000000000000000008"), 8);
});
