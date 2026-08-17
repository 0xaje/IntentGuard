import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract, Signer } from "ethers";

const RECEIPT_TYPES = {
  Receipt: [
    { name: "receiptId", type: "bytes32" },
    { name: "policyId", type: "bytes32" },
    { name: "intentHash", type: "bytes32" },
    { name: "requestHash", type: "bytes32" },
    { name: "evidenceHash", type: "bytes32" },
    { name: "chainId", type: "uint256" },
    { name: "transactionSubject", type: "address" },
    { name: "evaluator", type: "address" },
    { name: "verdict", type: "uint8" },
    { name: "policyVersion", type: "uint64" },
    { name: "evaluatedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "engineVersion", type: "uint32" },
    { name: "decoderVersion", type: "uint32" },
  ],
};

type Fixture = {
  admin: Signer;
  subject: Signer;
  evaluator: Signer;
  outsider: Signer;
  policy: Contract;
  receipt: Contract;
  target: Contract;
  policyId: string;
};

async function deployFixture(): Promise<Fixture> {
  const [admin, subject, evaluator, outsider] = await ethers.getSigners();
  const Policy = await ethers.getContractFactory("IntentGuardPolicyRegistry");
  const policy = await Policy.deploy(await admin.getAddress());
  await policy.waitForDeployment();

  const Receipt = await ethers.getContractFactory("IntentGuardReceiptRegistry");
  const receipt = await Receipt.deploy(
    await admin.getAddress(),
    await policy.getAddress(),
  );
  await receipt.waitForDeployment();

  const Target = await ethers.getContractFactory("IntentGuardTargetRegistry");
  const target = await Target.deploy(await admin.getAddress());
  await target.waitForDeployment();

  const intentHash = ethers.id("intent-v1");
  const subjectAddress = await subject.getAddress();
  const policyId = await policy.connect(subject).commitPolicy.staticCall(
    intentHash,
    subjectAddress,
    1,
    0,
    0,
    "ipfs://intentguard/policy-v1",
  );
  await policy.connect(subject).commitPolicy(
    intentHash,
    subjectAddress,
    1,
    0,
    0,
    "ipfs://intentguard/policy-v1",
  );

  const evaluatorRole = await receipt.EVALUATOR_ROLE();
  await receipt.connect(admin).grantRole(evaluatorRole, await evaluator.getAddress());

  return { admin, subject, evaluator, outsider, policy, receipt, target, policyId };
}

async function makeReceipt(fixture: Fixture, overrides: Partial<Record<string, unknown>> = {}) {
  const network = await ethers.provider.getNetwork();
  const timestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
  return {
    receiptId: overrides.receiptId ?? ethers.id(`receipt-${Date.now()}-${Math.random()}`),
    policyId: overrides.policyId ?? fixture.policyId,
    intentHash: overrides.intentHash ?? ethers.id("intent"),
    requestHash: overrides.requestHash ?? ethers.id("request"),
    evidenceHash: overrides.evidenceHash ?? ethers.id("evidence"),
    chainId: overrides.chainId ?? Number(network.chainId),
    transactionSubject: overrides.transactionSubject ?? await fixture.subject.getAddress(),
    evaluator: overrides.evaluator ?? await fixture.evaluator.getAddress(),
    verdict: overrides.verdict ?? 0,
    policyVersion: overrides.policyVersion ?? 1,
    evaluatedAt: overrides.evaluatedAt ?? timestamp,
    expiresAt: overrides.expiresAt ?? timestamp + 600,
    engineVersion: overrides.engineVersion ?? 1_000_000,
    decoderVersion: overrides.decoderVersion ?? 1_000_000,
  };
}

async function signReceipt(receiptContract: Contract, evaluator: Signer, receipt: Record<string, unknown>) {
  const network = await ethers.provider.getNetwork();
  const domain = {
    name: "IntentGuard Receipt Registry",
    version: "1",
    chainId: Number(network.chainId),
    verifyingContract: await receiptContract.getAddress(),
  };
  return evaluator.signTypedData(domain, RECEIPT_TYPES, receipt);
}

describe("IntentGuardPolicyRegistry", function () {
  it("commits deterministic policies and allows owner revocation", async function () {
    const fixture = await deployFixture();
    const policy = await fixture.policy.getPolicy(fixture.policyId);

    expect(policy[0].policyOwner).to.equal(await fixture.subject.getAddress());
    expect(policy[0].committer).to.equal(await fixture.subject.getAddress());
    expect(policy[0].intentHash).to.equal(ethers.id("intent-v1"));
    expect(policy[1]).to.equal(false);
    expect(await fixture.policy.isPolicyActive(fixture.policyId)).to.equal(true);

    await expect(fixture.policy.connect(fixture.subject).revokePolicy(fixture.policyId))
      .to.emit(fixture.policy, "PolicyRevoked");
    expect(await fixture.policy.isPolicyActive(fixture.policyId)).to.equal(false);
  });

  it("rejects revocation by an unrelated address", async function () {
    const fixture = await deployFixture();
    await expect(
      fixture.policy.connect(fixture.outsider).revokePolicy(fixture.policyId),
    ).to.be.revertedWithCustomError(fixture.policy, "NotPolicyOwner");
  });
});

describe("IntentGuardReceiptRegistry", function () {
  it("anchors a valid signed receipt and verifies it", async function () {
    const fixture = await deployFixture();
    const receipt = await makeReceipt(fixture);
    const signature = await signReceipt(fixture.receipt, fixture.evaluator, receipt);

    await expect(fixture.receipt.connect(fixture.outsider).anchorReceipt(receipt, signature))
      .to.emit(fixture.receipt, "ReceiptAnchored")
      .withArgs(
        receipt.receiptId,
        fixture.policyId,
        receipt.intentHash,
        await fixture.subject.getAddress(),
        await fixture.evaluator.getAddress(),
        0,
        receipt.evaluatedAt,
        receipt.expiresAt,
        receipt.evidenceHash,
      );

    expect(await fixture.receipt.isReceiptValid(receipt.receiptId)).to.equal(true);
  });

  it("rejects an invalid evaluator signature", async function () {
    const fixture = await deployFixture();
    const receipt = await makeReceipt(fixture);
    const signature = await signReceipt(fixture.receipt, fixture.subject, receipt);

    await expect(
      fixture.receipt.anchorReceipt(receipt, signature),
    ).to.be.revertedWithCustomError(fixture.receipt, "InvalidSignature");
  });

  it("rejects a receipt for a revoked policy", async function () {
    const fixture = await deployFixture();
    await fixture.policy.connect(fixture.subject).revokePolicy(fixture.policyId);
    const receipt = await makeReceipt(fixture);
    const signature = await signReceipt(fixture.receipt, fixture.evaluator, receipt);

    await expect(
      fixture.receipt.anchorReceipt(receipt, signature),
    ).to.be.revertedWithCustomError(fixture.receipt, "PolicyNotActive");
  });

  it("supports subject revocation and pause control", async function () {
    const fixture = await deployFixture();
    const receipt = await makeReceipt(fixture);
    const signature = await signReceipt(fixture.receipt, fixture.evaluator, receipt);
    await fixture.receipt.anchorReceipt(receipt, signature);

    await expect(fixture.receipt.connect(fixture.subject).revokeReceipt(receipt.receiptId))
      .to.emit(fixture.receipt, "ReceiptRevoked");
    expect(await fixture.receipt.isReceiptValid(receipt.receiptId)).to.equal(false);

    await fixture.receipt.pause();
    const second = await makeReceipt(fixture, { receiptId: ethers.id("receipt-second") });
    const secondSignature = await signReceipt(fixture.receipt, fixture.evaluator, second);
    await expect(fixture.receipt.anchorReceipt(second, secondSignature))
      .to.be.revertedWithCustomError(fixture.receipt, "EnforcedPause");
  });
});

describe("IntentGuardTargetRegistry", function () {
  it("stores versioned target metadata and restricts managers", async function () {
    const fixture = await deployFixture();
    const targetAddress = "0x7777777777777777777777777777777777777777";
    const selector = "0x095ea7b3";
    const managerRole = await fixture.target.TARGET_MANAGER_ROLE();

    await expect(
      fixture.target.connect(fixture.outsider).setTarget(
        targetAddress,
        selector,
        1,
        ethers.id("target-metadata-v1"),
        1,
        "ipfs://intentguard/target-v1",
      ),
    ).to.be.revertedWithCustomError(fixture.target, "AccessControlUnauthorizedAccount");

    expect(await fixture.target.hasRole(managerRole, await fixture.admin.getAddress())).to.equal(true);
    await fixture.target.connect(fixture.admin).setTarget(
      targetAddress,
      selector,
      1,
      ethers.id("target-metadata-v1"),
      1,
      "ipfs://intentguard/target-v1",
    );
    const record = await fixture.target.getTarget(targetAddress, selector);
    expect(record.target).to.equal(targetAddress);
    expect(record.status).to.equal(1);
    expect(await fixture.target.targetStatus(targetAddress, selector)).to.equal(1);
  });
});
