# IntentGuard MVP

IntentGuard is a non-custodial transaction-intent analysis MVP. It decodes selected ERC-20 calldata and ERC-2612-style typed-data permits, applies deterministic policy rules, and returns `MATCH`, `MISMATCH`, or `CANNOT_VERIFY`. The Solidity registries anchor policy commitments, signed evaluator receipts, and curated target metadata.

> IntentGuard never requests seed phrases or private keys, never signs or broadcasts transactions, and never holds user funds. A `MATCH` result means only that the supplied request matched the supplied policy under the checks implemented by the selected engine version.

## Repository layout

```text
contracts/       Solidity registries and Hardhat tests
engine/src/      Typed decoder, canonical hashing, policy engine, receipt helpers
engine/test/     Deterministic TypeScript tests
scripts/         Deployment script
docs/            Deployment and protocol notes
```

## Install

```bash
pnpm install
pnpm approve-builds --all
```

The project pins Solidity `0.8.24`, OpenZeppelin Contracts `5.4.0`, ethers `6.15.0`, Hardhat `2.26.3`, TypeScript `5.9.2`, and Zod `4.1.5`.

## Verify

```bash
pnpm run compile:contracts
pnpm run lint:types
pnpm run test:contracts
pnpm run test:engine
pnpm test
```

The engine tests cover exact approvals, unlimited approvals, wrong spenders, unknown selectors, native-value violations, permits, EIP-712 receipt data, and receipt hashing. The Hardhat tests cover policy ownership and revocation, receipt signatures and expiry/revocation behavior, pausing, evaluator access, and target registry access control.

## Use the TypeScript engine

```ts
import {
  analyze,
  buildErc20ApproveData,
  makeReceipt,
  receiptTypedData,
} from "./engine/src/index";

const intent = {
  schemaVersion: 1 as const,
  chainId: 84532 as const,
  action: "APPROVE" as const,
  asset: { address: "0x2222222222222222222222222222222222222222" },
  spendCap: {
    token: "0x2222222222222222222222222222222222222222",
    maxRaw: "100000000000000000000",
  },
  spender: { exact: "0x3333333333333333333333333333333333333333" },
  approvalPolicy: "EXACT_ONLY" as const,
  permitPolicy: "NOT_APPLICABLE" as const,
  allowNativeValue: false,
  allowUnknownSelectors: false,
};

const analysis = analyze(
  {
    intent,
    request: {
      schemaVersion: 1,
      chainId: 84532,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      valueWei: "0",
      data: buildErc20ApproveData(
        "0x3333333333333333333333333333333333333333",
        "100000000000000000000",
      ),
      source: "FIXTURE",
    },
  },
  { chainId: 84532, now: 1_700_000_000 },
);

console.log(analysis.verdict, analysis.rules, analysis.evidence);
const receipt = makeReceipt({
  analysis,
  subject: "0x1111111111111111111111111111111111111111",
  evaluator: "0x5555555555555555555555555555555555555555",
});
const typedData = receiptTypedData({
  registryAddress: "0x6666666666666666666666666666666666666666",
  receipt,
});
```

The evaluator service signs `typedData` with its own evaluator key and submits the receipt struct plus signature to `IntentGuardReceiptRegistry.anchorReceipt`.

## Deploy locally

```bash
pnpm run deploy:local
```

For a staging deployment, set `INTENTGUARD_ADMIN` and `INTENTGUARD_EVALUATOR`, configure the Hardhat network RPC and private key in a local environment file, then run the deployment script against Base Sepolia. The script prints a JSON deployment manifest with the three contract addresses and chain ID.

## Contract roles

- `DEFAULT_ADMIN_ROLE`: multisig or deployment administrator.
- `PAUSER_ROLE`: can stop new receipt anchoring.
- `EVALUATOR_ROLE`: authorized evaluator addresses whose signatures may anchor receipts.
- `TARGET_MANAGER_ROLE`: curated target metadata manager.

The registry contracts do not make arbitrary external calls and do not hold ETH or ERC-20 balances.

## Supported decoding in the MVP

- ERC-20 `transfer(address,uint256)`.
- ERC-20 `approve(address,uint256)`.
- ERC-2612-style `Permit(owner,spender,value,nonce,deadline)` typed data.
- Native transfers with empty calldata and nonzero `valueWei`.
- Unknown calldata, which fails closed as `CANNOT_VERIFY` unless the caller explicitly allows unknown selectors; even then, the decoder does not issue a positive verdict without sufficient evidence.

Generic router swaps, nested calls, simulation adapters, wallet adapters, and universal EOA enforcement are intentionally outside this core implementation.
