import assert from "node:assert/strict";
import test from "node:test";
import {
  analyze,
  buildErc20ApproveData,
  buildErc20TransferData,
  Verdict,
  verifyAgentAction,
} from "../src/index";
import type { IntentSpec, ProposedRequest } from "../src/index";

const VALID_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ALICE = "0xb8069ea05dca32f8116f1af6bb719155274010fa";
const HACKER = "0x999999cf1046e68e36e1aa2e0e07105eddd840bd";

const baseTransferIntent: IntentSpec = {
  schemaVersion: 1,
  chainId: 8453,
  action: "TRANSFER",
  asset: { address: VALID_TOKEN },
  recipient: { exact: ALICE },
  spendCap: { token: VALID_TOKEN, maxRaw: "10000000" }, // 10 USDC
  approvalPolicy: "EXACT_ONLY",
  permitPolicy: "NOT_APPLICABLE",
  allowNativeValue: false,
  allowUnknownSelectors: false,
};

test("Invariant 1: Any amount exceeding maxRaw must NEVER return MATCH", () => {
  const testAmounts = [
    "10000001", // 10.000001 USDC
    "15000000", // 15 USDC
    "100000000", // 100 USDC
    "1000000000000000000", // 1M USDC
    ((1n << 256n) - 1n).toString(), // Max uint256
  ];

  for (const amount of testAmounts) {
    const req: ProposedRequest = {
      schemaVersion: 1,
      chainId: 8453,
      to: VALID_TOKEN,
      data: buildErc20TransferData(ALICE, amount),
      valueWei: "0",
    };

    const result = verifyAgentAction({ intent: baseTransferIntent, request: req });
    assert.notEqual(result.verdict, Verdict.MATCH, `Amount ${amount} erroneously matched!`);
    assert.equal(result.isSafe, false);
    assert.equal(result.verdict, Verdict.MISMATCH);
    assert.equal(result.primaryReasonCode, "IG-AMOUNT-001");
  }
});

test("Invariant 2: Any recipient other than declared target must NEVER return MATCH", () => {
  const badRecipients = [
    HACKER,
    "0x0000000000000000000000000000000000000000",
    "0x1111111111111111111111111111111111111111",
    "0xdead00000000000000000000000000000000beef",
  ];

  for (const badTo of badRecipients) {
    const req: ProposedRequest = {
      schemaVersion: 1,
      chainId: 8453,
      to: VALID_TOKEN,
      data: buildErc20TransferData(badTo, "10000000"),
      valueWei: "0",
    };

    const result = verifyAgentAction({ intent: baseTransferIntent, request: req });
    assert.notEqual(result.verdict, Verdict.MATCH, `Recipient ${badTo} erroneously matched!`);
    assert.equal(result.isSafe, false);
    assert.equal(result.verdict, Verdict.MISMATCH);
    assert.equal(result.primaryReasonCode, "IG-RECIPIENT-001");
  }
});

test("Invariant 3: Random garbage / truncated calldata must fail closed", () => {
  const junkCalldata: `0x${string}`[] = [
    "0x",
    "0x00",
    "0xdeadbeef",
    "0xa9059cbb", // selector only without params
    "0xa9059cbb000000000000000000000000", // truncated params
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  ];

  for (const data of junkCalldata) {
    const req: ProposedRequest = {
      schemaVersion: 1,
      chainId: 8453,
      to: VALID_TOKEN,
      data,
      valueWei: "0",
    };

    const result = verifyAgentAction({ intent: baseTransferIntent, request: req });
    assert.notEqual(result.verdict, Verdict.MATCH, `Junk calldata ${data} erroneously matched!`);
    assert.equal(result.isSafe, false);
  }
});

test("Invariant 4: Attaching unallowed native ETH value must fail closed", () => {
  const req: ProposedRequest = {
    schemaVersion: 1,
    chainId: 8453,
    to: VALID_TOKEN,
    data: buildErc20TransferData(ALICE, "10000000"),
    valueWei: "1000000000000000", // 0.001 ETH
  };

  const result = verifyAgentAction({ intent: baseTransferIntent, request: req });
  assert.equal(result.verdict, Verdict.MISMATCH);
  assert.equal(result.isSafe, false);
  assert.equal(result.primaryReasonCode, "IG-NATIVE-001");
});
