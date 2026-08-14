import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      metadata: {
        bytecodeHash: "none",
      },
    },
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL ?? "",
      accounts: process.env.INTENTGUARD_DEPLOYER_PRIVATE_KEY
        ? [process.env.INTENTGUARD_DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 84532,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./contracts/test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 120_000,
  },
};

export default config;
