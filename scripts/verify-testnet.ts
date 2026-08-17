import { AbiCoder, Contract, JsonRpcProvider, Wallet, keccak256, zeroPadValue } from "ethers";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_SEPOLIA_CHAIN_ID = 84532;
const ZERO_BYTES32 = `0x${"00".repeat(32)}`;
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

const POLICY_ABI = [
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function commitPolicy(bytes32 policyHash,uint64 version,uint64 validAfter,uint64 validUntil,string metadataURI) returns (bytes32 policyId)",
  "function getPolicy(bytes32 policyId) view returns ((bytes32 policyHash,address owner,uint64 version,uint64 validAfter,uint64 validUntil,string metadataURI),bool revoked)",
  "function isPolicyActive(bytes32 policyId) view returns (bool)",
  "function nextNonce(address owner) view returns (uint256)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
];

const RECEIPT_ABI = [
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function EVALUATOR_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)",
  "function anchorReceipt((bytes32 receiptId,bytes32 policyId,bytes32 intentHash,bytes32 requestHash,bytes32 evidenceHash,uint256 chainId,address subject,address evaluator,uint8 verdict,uint64 policyVersion,uint64 evaluatedAt,uint64 expiresAt,uint32 engineVersion,uint32 decoderVersion) receipt,bytes evaluatorSignature) returns (bytes32)",
  "function isReceiptValid(bytes32 receiptId) view returns (bool)",
  "function revokeReceipt(bytes32 receiptId)",
  "function getReceipt(bytes32 receiptId) view returns ((bytes32 receiptId,bytes32 policyId,bytes32 intentHash,bytes32 requestHash,bytes32 evidenceHash,uint256 chainId,address subject,address evaluator,uint8 verdict,uint64 policyVersion,uint64 evaluatedAt,uint64 expiresAt,uint32 engineVersion,uint32 decoderVersion),bool revoked)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
];

const TARGET_ABI = [
  "function TARGET_MANAGER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
];

type DeploymentManifest = {
  chainId: number;
  admin: string;
  evaluator: string | null;
  policyRegistry: string;
  receiptRegistry: string;
  targetRegistry: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  console.log(`PASS  ${label}: ${String(actual)}`);
}

function assertTrue(condition: boolean, label: string): void {
  if (!condition) throw new Error(`FAIL  ${label}`);
  console.log(`PASS  ${label}`);
}

function computePolicyId(owner: string, nonce: bigint, policyHash: string, version: number): string {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "bytes32", "uint64"],
    [owner, nonce, policyHash, version],
  );
  return keccak256(encoded);
}

function deploymentPath(): string {
  return resolve(process.env.INTENTGUARD_DEPLOYMENT_FILE ?? "deployments/baseSepolia.json");
}

async function main(): Promise<void> {
  const rpcUrl = required("BASE_SEPOLIA_RPC_URL");
  const deployerKey = required("INTENTGUARD_DEPLOYER_PRIVATE_KEY");
  const evaluatorKey = required("INTENTGUARD_EVALUATOR_PRIVATE_KEY");
  const path = deploymentPath();
  if (!existsSync(path)) throw new Error(`Deployment manifest does not exist: ${path}`);

  const manifest = JSON.parse(readFileSync(path, "utf8")) as DeploymentManifest;
  const provider = new JsonRpcProvider(rpcUrl, BASE_SEPOLIA_CHAIN_ID, { staticNetwork: true });
  const network = await provider.getNetwork();
  assertEqual(Number(network.chainId), BASE_SEPOLIA_CHAIN_ID, "Base Sepolia chain ID");

  const deployer = new Wallet(deployerKey, provider);
  const evaluator = new Wallet(evaluatorKey, provider);
  assertEqual(manifest.chainId, BASE_SEPOLIA_CHAIN_ID, "deployment manifest chain ID");
  assertEqual((await deployer.getAddress()).toLowerCase(), manifest.admin.toLowerCase(), "admin address");
  if (manifest.evaluator) {
    assertEqual((await evaluator.getAddress()).toLowerCase(), manifest.evaluator.toLowerCase(), "evaluator address");
  }

  for (const [label, address] of Object.entries({
    policyRegistry: manifest.policyRegistry,
    receiptRegistry: manifest.receiptRegistry,
    targetRegistry: manifest.targetRegistry,
  })) {
    const code = await provider.getCode(address);
    assertTrue(code !== "0x", `${label} has deployed bytecode at ${address}`);
  }

  const policy = new Contract(manifest.policyRegistry, POLICY_ABI, deployer);
  const receipt = new Contract(manifest.receiptRegistry, RECEIPT_ABI, deployer);
  const target = new Contract(manifest.targetRegistry, TARGET_ABI, deployer);
  const adminAddress = await deployer.getAddress();
  const evaluatorAddress = await evaluator.getAddress();

  const adminRole = await policy.DEFAULT_ADMIN_ROLE();
  assertTrue(await policy.hasRole(adminRole, adminAddress), "admin has policy DEFAULT_ADMIN_ROLE");
  const receiptAdminRole = await receipt.DEFAULT_ADMIN_ROLE();
  assertTrue(await receipt.hasRole(receiptAdminRole, adminAddress), "admin has receipt DEFAULT_ADMIN_ROLE");
  const pauserRole = await receipt.PAUSER_ROLE();
  assertTrue(await receipt.hasRole(pauserRole, adminAddress), "admin has receipt PAUSER_ROLE");
  const evaluatorRole = await receipt.EVALUATOR_ROLE();
  assertTrue(await receipt.hasRole(evaluatorRole, evaluatorAddress), "evaluator has receipt EVALUATOR_ROLE");
  const targetManagerRole = await target.TARGET_MANAGER_ROLE();
  assertTrue(await target.hasRole(targetManagerRole, adminAddress), "admin has target TARGET_MANAGER_ROLE");

  const subject = adminAddress;
  const policyHash = keccak256(Buffer.from(`intentguard-testnet-policy-${Date.now()}`));
  const policyVersion = 1;
  const nonce = BigInt(await policy.nextNonce(subject));
  const policyId = computePolicyId(subject, nonce, policyHash, policyVersion);
  const policyTx = await policy.commitPolicy(
    policyHash,
    policyVersion,
    0,
    0,
    "intentguard://testnet-verification-policy-v1",
  );
  const policyReceipt = await policyTx.wait();
  if (!policyReceipt) throw new Error("Policy commitment transaction was not mined");
  assertTrue(await policy.isPolicyActive(policyId), "test policy is active");

  const latest = await provider.getBlock("latest");
  if (!latest) throw new Error("Unable to read latest Base Sepolia block");
  const receiptId = zeroPadValue(keccak256(Buffer.from(`intentguard-testnet-receipt-${Date.now()}`)), 32);
  const intentHash = keccak256(Buffer.from("intentguard-testnet-intent"));
  const requestHash = keccak256(Buffer.from("intentguard-testnet-request"));
  const evidenceHash = keccak256(Buffer.from("intentguard-testnet-evidence"));
  const testReceipt = {
    receiptId,
    policyId,
    intentHash,
    requestHash,
    evidenceHash,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    subject,
    evaluator: evaluatorAddress,
    verdict: 1,
    policyVersion,
    evaluatedAt: latest.timestamp,
    expiresAt: latest.timestamp + 600,
    engineVersion: 1_000_000,
    decoderVersion: 1_000_000,
  };

  const domain = {
    name: "IntentGuard Receipt Registry",
    version: "1",
    chainId: BASE_SEPOLIA_CHAIN_ID,
    verifyingContract: manifest.receiptRegistry,
  };
  const signature = await evaluator.signTypedData(domain, RECEIPT_TYPES, testReceipt);
  const anchorTx = await receipt.anchorReceipt(testReceipt, signature);
  const anchorReceipt = await anchorTx.wait();
  if (!anchorReceipt) throw new Error("Receipt anchoring transaction was not mined");
  assertTrue(await receipt.isReceiptValid(receiptId), "test receipt is valid after anchoring");

  const stored = await receipt.getReceipt(receiptId);
  assertEqual(stored[0].policyId, policyId, "stored receipt policy ID");
  assertEqual(stored[0].evaluator.toLowerCase(), evaluatorAddress.toLowerCase(), "stored evaluator");
  assertEqual(stored[0].verdict, 1n, "stored mismatch verdict");

  const revokeTx = await receipt.revokeReceipt(receiptId);
  const revokeReceipt = await revokeTx.wait();
  if (!revokeReceipt) throw new Error("Receipt revocation transaction was not mined");
  assertTrue(!(await receipt.isReceiptValid(receiptId)), "test receipt is invalid after revocation");

  const output = {
    verifiedAt: new Date().toISOString(),
    chainId: BASE_SEPOLIA_CHAIN_ID,
    deployment: manifest,
    transactions: {
      policyCommitment: policyReceipt.hash,
      receiptAnchor: anchorReceipt.hash,
      receiptRevocation: revokeReceipt.hash,
    },
    policyId,
    receiptId,
    subject,
    evaluator: evaluatorAddress,
  };
  const outputPath = resolve(process.env.INTENTGUARD_VERIFICATION_OUTPUT ?? "deployments/baseSepolia-verification.json");
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`PASS  verification result written to ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
