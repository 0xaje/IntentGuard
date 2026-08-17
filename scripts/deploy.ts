import { ethers } from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const admin = process.env.INTENTGUARD_ADMIN ?? await deployer.getAddress();
  const evaluator = process.env.INTENTGUARD_EVALUATOR;

  const Policy = await ethers.getContractFactory("IntentGuardPolicyRegistry");
  const policy = await Policy.deploy(admin);
  await policy.waitForDeployment();

  const Receipt = await ethers.getContractFactory("IntentGuardReceiptRegistry");
  const receipt = await Receipt.deploy(admin, await policy.getAddress());
  await receipt.waitForDeployment();

  const Target = await ethers.getContractFactory("IntentGuardTargetRegistry");
  const target = await Target.deploy(admin);
  await target.waitForDeployment();

  if (evaluator !== undefined) {
    const evaluatorRole = await receipt.EVALUATOR_ROLE();
    const tx = await receipt.grantRole(evaluatorRole, evaluator);
    await tx.wait();
  }

  const network = await ethers.provider.getNetwork();
  const deployment = {
    chainId: Number(network.chainId),
    admin,
    evaluator: evaluator ?? null,
    policyRegistry: await policy.getAddress(),
    receiptRegistry: await receipt.getAddress(),
    targetRegistry: await target.getAddress(),
  };

  const outputPath = process.env.INTENTGUARD_DEPLOYMENT_OUTPUT;
  if (outputPath) {
    writeFileSync(resolve(outputPath), `${JSON.stringify(deployment, null, 2)}\\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    console.log(`Deployment manifest written to ${resolve(outputPath)}`);
  }
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
