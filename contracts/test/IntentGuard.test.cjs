const { expect } = require("chai");
const { ethers } = require("hardhat");

const RECEIPT_TYPES = {
  Receipt: [
    { name: "receiptId", type: "bytes32" },
    { name: "policyId", type: "bytes32" },
    { name: "intentHash", type: "bytes32" },
    { name: "requestHash", type: "bytes32" },
    { name: "evidenceHash", type: "bytes32" },
    { name: "chainId", type: "uint256" },
    { name: "subject", type: "address" },
    { name: "evaluator", type: "address" },
    { name: "verdict", type: "uint8" },
    { name: "policyVersion", type: "uint64" },
    { name: "evaluatedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "engineVersion", type: "uint32" },
    { name: "decoderVersion", type: "uint32" },
  ],
};

let receiptNonce = 0;

async function deployFixture() {
  const [admin, subject, evaluator, outsider] = await ethers.getSigners();
  const Policy = await ethers.getContractFactory("IntentGuardPolicyRegistry");
  const policy = await Policy.deploy(await admin.getAddress());
  await policy.waitForDeployment();

  const Receipt = await ethers.getContractFactory("IntentGuardReceiptRegistry");
  const receipt = await Receipt.deploy(await admin.getAddress(), await policy.getAddress());
  await receipt.waitForDeployment();

  const Target = await ethers.getContractFactory("IntentGuardTargetRegistry");
  const target = await Target.deploy(await admin.getAddress());
  await target.waitForDeployment();

  const policyHash = ethers.id("intentguard-policy-v1");
  const policyId = await policy.connect(admin).commitPolicy.staticCall(
    policyHash,
    1,
    0,
    0,
    "ipfs://intentguard/policy-v1",
  );
  await policy.connect(admin).commitPolicy(policyHash, 1, 0, 0, "ipfs://intentguard/policy-v1");

  await receipt.connect(admin).grantRole(await receipt.EVALUATOR_ROLE(), await evaluator.getAddress());
  return { admin, subject, evaluator, outsider, policy, receipt, target, policyId };
}

async function makeReceipt(fixture, overrides = {}) {
  const network = await ethers.provider.getNetwork();
  const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
  return {
    receiptId: ethers.id(`receipt-${receiptNonce++}`),
    policyId: fixture.policyId,
    intentHash: ethers.id("intent"),
    requestHash: ethers.id("request"),
    evidenceHash: ethers.id("evidence"),
    chainId: Number(network.chainId),
    subject: await fixture.subject.getAddress(),
    evaluator: await fixture.evaluator.getAddress(),
    verdict: 0,
    policyVersion: 1,
    evaluatedAt: timestamp,
    expiresAt: timestamp + 600,
    engineVersion: 1_000_000,
    decoderVersion: 1_000_000,
    ...overrides,
  };
}

async function signReceipt(receiptContract, evaluator, receipt) {
  const network = await ethers.provider.getNetwork();
  return evaluator.signTypedData(
    {
      name: "IntentGuard Receipt Registry",
      version: "1",
      chainId: Number(network.chainId),
      verifyingContract: await receiptContract.getAddress(),
    },
    RECEIPT_TYPES,
    receipt,
  );
}

describe("IntentGuardPolicyRegistry", function () {
  it("commits an active policy under the policy committer and permits its revocation", async function () {
    const fixture = await deployFixture();
    const [policyCommitment, revoked] = await fixture.policy.getPolicy(fixture.policyId);

    expect(policyCommitment.owner).to.equal(await fixture.admin.getAddress());
    expect(await fixture.policy.policyCommitter(fixture.policyId)).to.equal(await fixture.admin.getAddress());
    expect(policyCommitment.policyHash).to.equal(ethers.id("intentguard-policy-v1"));
    expect(revoked).to.equal(false);
    expect(await fixture.policy.isPolicyActive(fixture.policyId)).to.equal(true);

    await expect(fixture.policy.connect(fixture.admin).revokePolicy(fixture.policyId))
      .to.emit(fixture.policy, "PolicyRevoked");
    expect(await fixture.policy.isPolicyActive(fixture.policyId)).to.equal(false);
  });

  it("rejects an unrelated revocation attempt", async function () {
    const fixture = await deployFixture();
    await expect(fixture.policy.connect(fixture.outsider).revokePolicy(fixture.policyId))
      .to.be.revertedWithCustomError(fixture.policy, "NotPolicyOwner");
  });
});

describe("IntentGuardReceiptRegistry", function () {
  it("anchors a valid evaluator-signed receipt with an independent real transaction subject", async function () {
    const fixture = await deployFixture();
    const record = await makeReceipt(fixture);
    const signature = await signReceipt(fixture.receipt, fixture.evaluator, record);

    expect(await fixture.policy.policyCommitter(fixture.policyId)).to.not.equal(record.subject);
    await expect(fixture.receipt.connect(fixture.outsider).anchorReceipt(record, signature))
      .to.emit(fixture.receipt, "ReceiptAnchored")
      .withArgs(
        record.receiptId,
        fixture.policyId,
        record.intentHash,
        record.subject,
        record.evaluator,
        0,
        record.evaluatedAt,
        record.expiresAt,
        record.evidenceHash,
      );

    const [stored, revoked] = await fixture.receipt.getReceipt(record.receiptId);
    expect(stored.subject).to.equal(record.subject);
    expect(stored.evaluator).to.equal(record.evaluator);
    expect(revoked).to.equal(false);
    expect(await fixture.receipt.isReceiptValid(record.receiptId)).to.equal(true);
  });

  it("rejects a replayed receipt identifier", async function () {
    const fixture = await deployFixture();
    const record = await makeReceipt(fixture);
    const signature = await signReceipt(fixture.receipt, fixture.evaluator, record);
    await fixture.receipt.anchorReceipt(record, signature);
    await expect(fixture.receipt.anchorReceipt(record, signature))
      .to.be.revertedWithCustomError(fixture.receipt, "ReceiptAlreadyExists");
  });

  it("rejects a signature that was not made by the declared evaluator", async function () {
    const fixture = await deployFixture();
    const record = await makeReceipt(fixture);
    const signature = await signReceipt(fixture.receipt, fixture.subject, record);
    await expect(fixture.receipt.anchorReceipt(record, signature))
      .to.be.revertedWithCustomError(fixture.receipt, "InvalidSignature");
  });

  it("rejects a receipt for a revoked policy", async function () {
    const fixture = await deployFixture();
    await fixture.policy.connect(fixture.admin).revokePolicy(fixture.policyId);
    const record = await makeReceipt(fixture);
    const signature = await signReceipt(fixture.receipt, fixture.evaluator, record);
    await expect(fixture.receipt.anchorReceipt(record, signature))
      .to.be.revertedWithCustomError(fixture.receipt, "PolicyNotActive");
  });

  it("rejects expired receipts and inverted receipt validity windows under a valid service-owned policy", async function () {
    const fixture = await deployFixture();
    const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
    const expired = await makeReceipt(fixture, { evaluatedAt: timestamp - 1_000, expiresAt: timestamp - 600 });
    const expiredSignature = await signReceipt(fixture.receipt, fixture.evaluator, expired);
    await expect(fixture.receipt.anchorReceipt(expired, expiredSignature))
      .to.be.revertedWithCustomError(fixture.receipt, "ReceiptExpired");

    const inverted = await makeReceipt(fixture, { evaluatedAt: timestamp, expiresAt: timestamp - 1 });
    const invertedSignature = await signReceipt(fixture.receipt, fixture.evaluator, inverted);
    await expect(fixture.receipt.anchorReceipt(inverted, invertedSignature))
      .to.be.revertedWithCustomError(fixture.receipt, "InvalidValidityWindow");
  });

  it("allows the subject to revoke their receipt and enforces the pause control", async function () {
    const fixture = await deployFixture();
    const record = await makeReceipt(fixture);
    const signature = await signReceipt(fixture.receipt, fixture.evaluator, record);
    await fixture.receipt.anchorReceipt(record, signature);

    await expect(fixture.receipt.connect(fixture.subject).revokeReceipt(record.receiptId))
      .to.emit(fixture.receipt, "ReceiptRevoked");
    expect(await fixture.receipt.isReceiptValid(record.receiptId)).to.equal(false);

    await fixture.receipt.connect(fixture.admin).pause();
    const second = await makeReceipt(fixture);
    const secondSignature = await signReceipt(fixture.receipt, fixture.evaluator, second);
    await expect(fixture.receipt.anchorReceipt(second, secondSignature))
      .to.be.revertedWithCustomError(fixture.receipt, "EnforcedPause");
  });
});

describe("IntentGuardTargetRegistry", function () {
  it("stores versioned target metadata and restricts target managers", async function () {
    const fixture = await deployFixture();
    const targetAddress = "0x7777777777777777777777777777777777777777";
    const selector = "0x095ea7b3";
    const managerRole = await fixture.target.TARGET_MANAGER_ROLE();

    await expect(fixture.target.connect(fixture.outsider).setTarget(
      targetAddress,
      selector,
      1,
      ethers.id("target-metadata-v1"),
      1,
      "ipfs://intentguard/target-v1",
    )).to.be.revertedWithCustomError(fixture.target, "AccessControlUnauthorizedAccount");

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
