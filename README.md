# IntentGuard

IntentGuard is a **no-wallet, read-only Base intent-verification application**. It parses a constrained Base intent, inspects an already-broadcast Base Mainnet transaction from the server, decodes supported transaction paths, and returns a deterministic `MATCH`, `MISMATCH`, or `UNVERIFIABLE` verdict with inspectable evidence.

The application does not connect a wallet, request a seed phrase, move funds, sign on behalf of a transaction sender, or fabricate blockchain evidence.

## Current capabilities

| Capability | Current behavior |
|---|---|
| Base Mainnet inspection | Reads real transaction, receipt, event-log, and network data from server-side Base JSON-RPC. |
| Supported decoding | Decodes Base USDC `approve`, `transfer`, and `transferFrom` calls, plus the allowlisted Uniswap V3 `SwapRouter02.exactInputSingle` path. |
| Evidence enrichment | Resolves router-path ERC-20 symbol/decimals through read-only calls and requests a read-only QuoterV2 estimate where applicable. |
| Deterministic verdicts | Returns `MATCH`, `MISMATCH`, or `UNVERIFIABLE`; unavailable evidence is never treated as a passing result. |
| Raw evidence | Displays returned RPC fields, decoding details, token metadata, and quote metadata in expandable disclosures. |
| Human review boundary | A local review acknowledgement is enabled only for `MATCH`; it does not sign or submit anything. |
| Cryptographic trust loop | Implements canonical policy/request/evidence commitments, EIP-712 receipt construction and recovery, and confirmation-gated Base Sepolia registry procedures. |

## Trust model: policy committer is not the transaction subject

The registry revision intentionally separates infrastructure authority from the person or account that sent the inspected Base Mainnet transaction.

```text
IntentGuard policy committer / owner
            ≠
Actual Base transaction subject
```

The policy registry preserves commitment ownership, policy versioning, validity windows, and revocation. The receipt registry requires an active policy when a policy ID is supplied, but it does **not** require the receipt subject to equal the policy owner. Instead, the signed receipt binds the real Base transaction subject independently.

Each canonical receipt binds the policy ID, canonical intent hash, request hash, evidence hash, Base Sepolia chain ID, actual transaction subject, evaluator, deterministic verdict, policy version, evaluation time, expiry, engine version, and decoder version. The Receipt EIP-712 type hash is:

```text
0x5c788492ed74a4250160711fd75d8e65b3e4d1b2499ff212473192503136d645
```

## Confirmation-gated trust-loop flow

1. The server canonicalizes the reviewed structured intent and hashes it with Ethereum keccak256.
2. A configured server-owned evaluator commits the policy to `IntentGuardPolicyRegistry` on Base Sepolia and waits for confirmation and on-chain readback before returning `COMMITTED`.
3. The server re-inspects the supplied Base Mainnet transaction. It refuses to anchor if a transaction or mined receipt is unavailable.
4. The server verifies that the active policy’s hash matches the canonical intent hash, constructs the receipt, signs the exact EIP-712 domain, and recovers the evaluator locally.
5. The server submits the receipt to `IntentGuardReceiptRegistry`, waits for confirmation, reads it back, and only then returns `ANCHORED`.

If any required configuration, chain check, role check, signature recovery, submission, confirmation, or on-chain readback fails, the procedure fails closed. It does not return a synthetic policy ID, signature, transaction hash, receipt, or anchored status.

## Base Sepolia status

The contracts have **not** been deployed to Base Sepolia from this repository session because the required deployment and evaluator credentials have not been configured. Consequently, this README intentionally contains no deployment address or transaction hash. The UI shows `NOT COMMITTED`, `NOT SIGNED`, and `NOT ANCHORED` until a real deployment and successful confirmed operation exist.

## Configuration

See [`environment.example.md`](./environment.example.md) for the complete configuration contract. The Base Mainnet verifier requires no user key. The optional trust loop requires server-only Base Sepolia infrastructure values:

```text
BASE_SEPOLIA_RPC_URL
INTENTGUARD_DEPLOYER_PRIVATE_KEY
INTENTGUARD_ADMIN
INTENTGUARD_EVALUATOR
EVALUATOR_PRIVATE_KEY
POLICY_REGISTRY_ADDRESS
RECEIPT_REGISTRY_ADDRESS
```

Do not commit `.env` files, private keys, artifacts, caches, or deployment manifests. They are excluded by `.gitignore`.

## Local validation

```bash
pnpm test
pnpm exec hardhat test
pnpm check
pnpm build
```

The current implementation has 15 passing Vitest tests and 9 passing Hardhat tests. See [`verification.md`](./verification.md) for the recorded evidence and limitations.

## Deployment sequence

Once the required Base Sepolia configuration is securely provided, deploy the revised registries and write the local deployment manifest:

```bash
INTENTGUARD_DEPLOYMENT_OUTPUT=deployments/baseSepolia.json \
pnpm exec hardhat run scripts/deploy.ts --network baseSepolia
```

Then set the confirmed `POLICY_REGISTRY_ADDRESS` and `RECEIPT_REGISTRY_ADDRESS`, and run:

```bash
INTENTGUARD_DEPLOYMENT_FILE=deployments/baseSepolia.json \
pnpm exec tsx scripts/verify-testnet.ts
```

Only copy the real addresses and confirmed transaction hashes into `verification.md` after both operations complete successfully.
