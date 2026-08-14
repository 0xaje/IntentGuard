# IntentGuard Base Sepolia Deployment Checklist

**Scope:** Deploy and verify the three non-custodial IntentGuard registries on Base Sepolia (`chainId 84532`) and produce a reproducible smoke-test result.

> **No production secrets belong in this repository.** Use a secret manager or local environment variables. Never commit a private key, RPC credential, `.env` file, seed phrase, or wallet export.

## 1. Go/no-go gates

| Gate | Required condition | Status |
|---|---|---|
| Source | Contract source is committed, reviewed, and compiled with pinned Solidity `0.8.24` settings. | ☐ |
| Dependencies | `pnpm-lock.yaml` is present and dependency build scripts are approved deliberately. | ☐ |
| Tests | Solidity and TypeScript unit tests pass from a clean install. | ☐ |
| Admin | Deployment admin is a dedicated Base Sepolia address, not a personal hot wallet. | ☐ |
| Evaluator | Evaluator key is separate from admin and only receives `EVALUATOR_ROLE`. | ☐ |
| Funding | Deployer has enough Base Sepolia ETH for three deployments, role setup, policy commitment, receipt anchor, and receipt revocation. | ☐ |
| RPC | RPC endpoint supports `eth_chainId`, `eth_getCode`, contract calls, and transaction receipt polling. | ☐ |
| Explorer | Contract verification credentials are available outside the repository. | ☐ |
| Recovery | Admin can pause receipt anchoring and rotate/revoke evaluator access. | ☐ |

## 2. Local preparation

Run these commands from the repository root:

```bash
pnpm install
pnpm approve-builds --all
pnpm run compile:contracts
pnpm run lint:types
pnpm run test:contracts
pnpm run test:engine
```

Confirm that the generated artifacts are not committed. The repository should contain source, tests, deployment scripts, and documentation—not private configuration or environment-specific secrets.

## 3. Environment variables

Create a local environment outside version control. The minimum variables are:

```bash
export BASE_SEPOLIA_RPC_URL="https://YOUR_BASE_SEPOLIA_RPC_ENDPOINT"
export INTENTGUARD_DEPLOYER_PRIVATE_KEY="0x..."
export INTENTGUARD_ADMIN="0x..."
export INTENTGUARD_EVALUATOR="0x..."
export INTENTGUARD_EVALUATOR_PRIVATE_KEY="0x..."
```

The deployer key must correspond to the deployment signer. `INTENTGUARD_ADMIN` should be the intended admin address; it may be a multisig only if the deployment flow is adjusted to perform role setup through that multisig. For the hackathon testnet, use a dedicated admin signer and record its address publicly, never its key.

Before deployment, verify the addresses:

```bash
node -e "for (const [k,v] of Object.entries(process.env)) if (k.includes('PRIVATE_KEY')) console.log(k, v ? 'SET' : 'MISSING')"
pnpm exec hardhat run scripts/deploy.ts --network baseSepolia
```

The command must be run only after checking that no secret will be printed by shell tracing, CI logs, or error output.

## 4. Deploy the registries

Deploy in this order:

1. `IntentGuardPolicyRegistry(admin)`.
2. `IntentGuardReceiptRegistry(admin, policyRegistry)`.
3. `IntentGuardTargetRegistry(admin)`.
4. Grant `EVALUATOR_ROLE` on the receipt registry to the dedicated evaluator address.
5. Confirm admin role ownership and save the public deployment manifest.

Use a public manifest with only addresses, chain ID, and role-holder addresses:

```json
{
  "chainId": 84532,
  "admin": "0x...",
  "evaluator": "0x...",
  "policyRegistry": "0x...",
  "receiptRegistry": "0x...",
  "targetRegistry": "0x..."
}
```

Do not store RPC URLs, private keys, mnemonic phrases, or signer objects in the manifest.

## 5. Verify deployed bytecode and roles

Check that every address has non-empty bytecode and that the roles are correct:

```bash
pnpm exec tsx scripts/verify-testnet.ts
```

The script checks the Base Sepolia chain ID, deployed bytecode, admin roles, `PAUSER_ROLE`, `EVALUATOR_ROLE`, and `TARGET_MANAGER_ROLE`. It then commits a test policy, anchors a signed mismatch receipt, checks receipt validity, revokes the receipt, and confirms that validity becomes false.

The script writes its result to `deployments/baseSepolia-verification.json`. This file is intentionally ignored by Git because it is environment-specific operational output. Share only the transaction hashes and public addresses when presenting the result.

## 6. Explorer verification

For each contract, verify the exact source and constructor arguments on the Base Sepolia explorer. The verified constructor arguments must match:

| Contract | Constructor arguments |
|---|---|
| `IntentGuardPolicyRegistry` | `admin` |
| `IntentGuardReceiptRegistry` | `admin`, `policyRegistry` |
| `IntentGuardTargetRegistry` | `admin` |

Confirm that compiler version, optimizer settings, `viaIR`, and metadata bytecode hash match the repository’s Hardhat configuration. Do not claim the contracts are verified until the explorer shows the exact source match.

## 7. Receipt smoke test

The expected smoke-test sequence is:

| Step | Expected result |
|---:|---|
| Read Base Sepolia chain ID | `84532` |
| Read code at all three addresses | Non-empty bytecode |
| Read admin roles | Admin has policy, receipt, pauser, and target-manager permissions |
| Read evaluator role | Evaluator has `EVALUATOR_ROLE` only |
| Commit test policy | Transaction mined; `isPolicyActive(policyId) == true` |
| Sign EIP-712 receipt | Signature recovers the evaluator address |
| Anchor mismatch receipt | `ReceiptAnchored` event emitted |
| Read receipt validity | `isReceiptValid(receiptId) == true` |
| Revoke receipt | `ReceiptRevoked` event emitted |
| Read receipt validity again | `isReceiptValid(receiptId) == false` |

## 8. Failure handling

If the verification script fails after deployment, do not redeploy blindly. First identify whether the failure is caused by an incorrect manifest, wrong chain, role configuration, evaluator signature, expired test receipt, RPC inconsistency, or insufficient gas. The registry contracts are append-only for policies and receipts, so repeated smoke tests should use fresh policy and receipt IDs.

If the evaluator key is suspected to be compromised, revoke `EVALUATOR_ROLE` from the admin and grant a new evaluator address. If the admin key is compromised, pause receipt anchoring, move governance to a new admin, and treat all receipts produced by the compromised evaluator as suspect until reviewed.

## 9. Presentation readiness

Before showing the deployment to judges, confirm that the public demo uses the same deployed contract addresses as the published manifest, the receipt explorer links resolve, the demo does not request a wallet connection, and the UI displays the contract and engine versions. Keep the verification output available locally but never expose private environment variables on screen.

## 10. Final release checklist

- [ ] Clean install passes.
- [ ] Solidity compile passes.
- [ ] TypeScript type check passes.
- [ ] Contract tests pass.
- [ ] Engine tests pass.
- [ ] Base Sepolia deployment manifest contains only public data.
- [ ] All three contracts have verified source.
- [ ] Admin, evaluator, and target-manager roles are documented.
- [ ] Smoke-test receipt was anchored and then revoked.
- [ ] `baseSepolia-verification.json` remains ignored.
- [ ] No `.env`, private key, RPC credential, or secret appears in Git history.
- [ ] Public pitch claims match the deployed implementation and supported scope.
