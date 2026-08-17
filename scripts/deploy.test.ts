import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const deploymentKeys = [
  "BASE_SEPOLIA_RPC_URL",
  "INTENTGUARD_DEPLOYER_PRIVATE_KEY",
  "INTENTGUARD_ADMIN",
  "INTENTGUARD_EVALUATOR",
  "EVALUATOR_PRIVATE_KEY",
] as const;

describe("Base Sepolia deployment preflight", () => {
  it("fails before deployment when required configuration is absent", () => {
    const environment = { ...process.env };
    for (const key of deploymentKeys) delete environment[key];

    const result = spawnSync(
      "pnpm",
      ["exec", "hardhat", "run", "scripts/deploy.cjs", "--network", "baseSepolia"],
      { cwd: process.cwd(), encoding: "utf8", env: environment, timeout: 30_000 },
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain("Missing required deployment configuration: BASE_SEPOLIA_RPC_URL");
    expect(output).not.toContain("Deployment manifest written");
  });
});
