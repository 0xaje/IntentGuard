require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, _hre, runSuper) => {
  if (solcVersion === "0.8.24") {
    return {
      version: "0.8.24",
      longVersion: "0.8.24+commit.e11b9ed9",
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
    };
  }
  return runSuper();
});

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
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
