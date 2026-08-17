import assert from "node:assert/strict";
import test from "node:test";
import {
  analyze,
  buildErc20ApproveData,
  buildPermitTypedData,
  makeReceipt,
  receiptHash,
  receiptTypedData,
  Verdict,
} from "../src/index";
import type { AnalysisInput, IntentSpec, ProposedRequest } from "../src/index";

const SUBJECT = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const SPENDER = "0x3333333333333333333333333333333333333333";
const OTHER_SPENDER = "0x4444444444444444444444444444444444444444";
const EVALUATOR = "0x5555555555555555555555555555555555555555";
const CAP = "100000000000000000000";

function approvalIntent(overrides: Partial<IntentSpec> = {}): IntentSpec {
  return {
    schemaVersion: 1,
    subject: SUBJECT,
    chainId: 84532,
    action: "APPROVE",
    asset: { address: TOKEN },
    spendCap: { token: TOKEN, maxRaw: CAP },
    spender: { exact: SPENDER },
    approvalPolicy: "EXACT_ONLY",
    permitPolicy: "NOT_APPLICABLE",
    allowNativeValue: false,
    allowUnknownSelectors: false,
    rawText: "Approve an exact amount for the trusted spender.",
    ...overrides,
  };
}

function request(data: `0x${string}`): ProposedRequest {
  return {
    schemaVersion: 1,
    chainId: 84532,
    from: SUBJECT,
    to: TOKEN,
    valueWei: "0",
    data,
    source: "FIXTURE",
  };
}

function input(intent: IntentSpec, proposed: ProposedRequest): AnalysisInput {
  return { intent, request: proposed };
}

test("exact ERC-20 approval returns MATCH", () => {
  const analysis = analyze(
    input(approvalIntent(), request(buildErc20ApproveData(SPENDER, CAP))),
    { chainId: 84532, now: 1_700_000_000 },
  );

  assert.equal(analysis.verdict, Verdict.MATCH);
  assert.equal(analysis.decodedEffect.kind, "ERC20_APPROVE");
  assert.equal(analysis.decodedEffect.amountRaw, CAP);
  assert.equal(analysis.primaryReasonCode, undefined);
});

test("unlimited approval returns MISMATCH", () => {
  const unlimited = ((1n << 256n) - 1n).toString();
  const analysis = analyze(
    input(approvalIntent(), request(buildErc20ApproveData(SPENDER, unlimited))),
    { chainId: 84532, now: 1_700_000_000 },
  );

  assert.equal(analysis.verdict, Verdict.MISMATCH);
  assert.equal(analysis.primaryReasonCode, "IG-AMOUNT-001");
  assert.match(analysis.explanation, /blocked/i);
});

test("wrong spender returns MISMATCH", () => {
  const analysis = analyze(
    input(approvalIntent(), request(buildErc20ApproveData(OTHER_SPENDER, CAP))),
    { chainId: 84532, now: 1_700_000_000 },
  );

  assert.equal(analysis.verdict, Verdict.MISMATCH);
  assert.equal(analysis.primaryReasonCode, "IG-APPROVE-002");
});

test("unknown selector fails closed", () => {
  const analysis = analyze(
    input(approvalIntent(), request("0x12345678")),
    { chainId: 84532, now: 1_700_000_000 },
  );

  assert.equal(analysis.verdict, Verdict.CANNOT_VERIFY);
  assert.equal(analysis.primaryReasonCode, "IG-ACTION-001");
});

test("native value is blocked when disallowed", () => {
  const analysis = analyze(
    input(
      {
        ...approvalIntent(),
        action: "TRANSFER",
        asset: { address: "NATIVE" },
      },
      {
        schemaVersion: 1,
        chainId: 84532,
        from: SUBJECT,
        to: SPENDER,
        valueWei: "100",
        source: "FIXTURE",
      },
    ),
    { chainId: 84532, now: 1_700_000_000 },
  );

  assert.equal(analysis.verdict, Verdict.MISMATCH);
  assert.equal(analysis.primaryReasonCode, "IG-NATIVE-001");
});

test("permit policy and domain are evaluated", () => {
  const typedData = buildPermitTypedData({
    token: TOKEN,
    chainId: 84532,
    name: "Test USD",
    version: "1",
    owner: SUBJECT,
    spender: SPENDER,
    value: CAP,
    nonce: "0",
    deadline: 1_700_000_100,
  });
  const analysis = analyze(
    input(
      {
        ...approvalIntent(),
        action: "PERMIT",
        approvalPolicy: "NOT_APPLICABLE",
        permitPolicy: "DISALLOW",
        permitMaxDeadlineSeconds: 600,
      },
      {
        schemaVersion: 1,
        chainId: 84532,
        from: SUBJECT,
        to: TOKEN,
        typedData,
        source: "FIXTURE",
      },
    ),
    { chainId: 84532, now: 1_700_000_000 },
  );

  assert.equal(analysis.verdict, Verdict.MISMATCH);
  assert.equal(analysis.primaryReasonCode, "IG-PERMIT-001");
  assert.equal(analysis.decodedEffect.kind, "ERC2612_PERMIT");
});

test("receipt is deterministic and produces EIP-712 typed data", () => {
  const analysis = analyze(
    input(approvalIntent(), request(buildErc20ApproveData(SPENDER, CAP))),
    { chainId: 84532, now: 1_700_000_000 },
  );
  const receipt = makeReceipt({ analysis, subject: SUBJECT, evaluator: EVALUATOR });
  const hash = receiptHash(receipt);
  const typed = receiptTypedData({
    registryAddress: "0x6666666666666666666666666666666666666666",
    receipt,
  });

  assert.match(hash, /^0x[0-9a-f]{64}$/);
  assert.equal(typed.domain.chainId, 84532);
  assert.equal(typed.value.intentHash, receipt.intentHash);
  assert.equal(typed.value.verdict, 0);
});
