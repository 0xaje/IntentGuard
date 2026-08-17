const { ethers } = require("hardhat");
const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const requiredDeploymentKeys = [
  "BASE_SEPOLIA_RPC_URL",
  "INTENTGUARD_DEPLOYER_PRIVATE_KEY",
  "INTENTGUARD_ADMIN",
  "INTENTGUARD_EVALUATOR",
  "EVALUATOR_PRIVATE_KEY",
];

function requireDeploymentValue(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required deployment configuration: ${key}`);
  }
  return value;
}

function validateRpcUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("BASE_SEPOLIA_RPC_URL must use http or https.");
  }
}

function validatePrivateKey(key, value) {
  if (!ethers.isHexString(value, 32)) {
    throw new Error(`${key} must be a 32-byte 0x-prefixed private key.`);
  }
}

function validateAddress(key, value) {
  if (!ethers.isAddress(value)) {
    throw new Error(`${key} must be a valid EVM address.`);
  }
  return ethers.getAddress(value);
}

async function main() {
  const rpcUrl = requireDeploymentValue("BASE_SEPOLIA_RPC_URL");
  const deployerPrivateKey = requireDeploymentValue("INTENTGUARD_DEPLOYER_PRIVATE_KEY");
  const admin = validateAddress("INTENTGUARD_ADMIN", requireDeploymentValue("INTENTGUARD_ADMIN"));
  const evaluator = validateAddress("INTENTGUARD_EVALUATOR", requireDeploymentValue("INTENTGUARD_EVALUATOR"));
  const evaluatorPrivateKey = requireDeploymentValue("EVALUATOR_PRIVATE_KEY");

  validateRpcUrl(rpcUrl);
  validatePrivateKey("INTENTGUARD_DEPLOYER_PRIVATE_KEY", deployerPrivateKey);
  validatePrivateKey("EVALUATOR_PRIVATE_KEY", evaluatorPrivateKey);

  if (ethers.getAddress(new ethers.Wallet(evaluatorPrivateKey).address) !== evaluator) {
    throw new Error("INTENTGUARD_EVALUATOR must be the address derived from EVALUATOR_PRIVATE_KEY.");
  }

  const [deployer] = await ethers.getSigners();
  const configuredDeployer = ethers.getAddress(new ethers.Wallet(deployerPrivateKey).address);
  if (ethers.getAddress(await deployer.getAddress()) !== configuredDeployer) {
    throw new Error("Hardhat signer does not match INTENTGUARD_DEPLOYER_PRIVATE_KEY.");
  }

  const Policy = await ethers.getContractFactory("IntentGuardPolicyRegistry");
  const policy = await Policy.deploy(admin);
  await policy.waitForDeployment();

  const Receipt = await ethers.getContractFactory("IntentGuardReceiptRegistry");
  const receipt = await Receipt.deploy(admin, await policy.getAddress());
  await receipt.waitForDeployment();

  const Target = await ethers.getContractFactory("IntentGuardTargetRegistry");
  const target = await Target.deploy(admin);
  await target.waitForDeployment();

  const evaluatorRole = await receipt.EVALUATOR_ROLE();
  const tx = await receipt.grantRole(evaluatorRole, evaluator);
  await tx.wait();

  const network = await ethers.provider.getNetwork();
  const deployment = {
    chainId: Number(network.chainId),
    admin,
    evaluator,
    policyRegistry: await policy.getAddress(),
    receiptRegistry: await receipt.getAddress(),
    targetRegistry: await target.getAddress(),
  };

  const outputPath = process.env.INTENTGUARD_DEPLOYMENT_OUTPUT;
  if (outputPath) {
    writeFileSync(resolve(outputPath), `${JSON.stringify(deployment, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    console.log(`Deployment manifest written to ${resolve(outputPath)}`);
  }
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
