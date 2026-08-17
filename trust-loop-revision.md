# IntentGuard subject-separation registry revision

## Audit outcome and implementation state

The active `feature/base-intent-verifier-v0.1` branch now contains the public React application, Express/tRPC backend, deterministic Base Mainnet verifier, policy engine, Uniswap allowlist, QuoterV2 evidence, token metadata resolution, Solidity registries, Hardhat tooling, canonical Ethereum hashing, EIP-712 receipt construction/recovery, server-side policy commitment and receipt-anchoring procedures, contract tests, and deployment-facing documentation.

The imported registry sources were reused rather than redesigned. No Base Sepolia deployment address or transaction hash existed in the imported sources, and none has been fabricated here. Deployment remains a pending live operation that requires server-only credentials and a funded testnet deployer.

## Existing inconsistency

The existing `IntentGuardReceiptRegistry` permits a non-zero `policyId` only when the committed policy is active **and** `PolicyCommitment.owner == Receipt.subject`. That incorrectly makes the policy committer the transaction subject in a service-operated, no-wallet flow. The existing receipt already separately EIP-712-binds `subject`, so preserving the equality check prevents an independent real transaction sender from being represented accurately.

## Minimal approved revision

The revision keeps the current storage, policy hash, policy ID derivation, policy validity checks, policy revocation, evaluator role, receipt ID replay protection, receipt expiry, EIP-712 field order, and `subject` receipt field.

| Component | Minimal change | Security effect |
|---|---|---|
| `IIntentGuardPolicyRegistry` | Add `policyCommitter(bytes32 policyId) -> address` as an explicit view of the existing policy owner/committer. | Makes policy responsibility explicit without changing storage or commit authorization. |
| `IntentGuardPolicyRegistry` | Implement `policyCommitter`; retain `owner` in stored commitments, only the owner/admin revocation rule, and the current `isPolicyActive` semantics. | Policy committer remains accountable and can revoke; no transaction-subject authority or custody is created. |
| `IntentGuardReceiptRegistry` | Require the non-zero policy to be active, but remove the `PolicyOwnerMismatch` requirement that compared policy committer with receipt subject. | The receipt binds the independent real transaction sender as `subject`; authorization remains evaluator-signature plus active service policy. |
| EIP-712 receipt | No field or ordering change. The existing `Receipt` schema already binds `policyId`, `intentHash`, `requestHash`, `evidenceHash`, `chainId`, `subject`, `evaluator`, verdict, versions, and expiry. | Keeps signatures compatible with the revised registry contract and preserves cryptographic attribution. |

## Trust model after revision

The service can pay for policy commitment and receipt anchoring, but it does not become the user’s transaction subject. The policy committer represents the service policy authority. The evaluator represents the authorized attestation signer. The receipt subject represents the actual observed Base transaction sender. The evaluator signature cryptographically binds those roles and all committed hashes. The revised registry therefore allows `policyCommitter != transactionSubject` while still requiring a valid policy and a role-authorized evaluator signature.

This revision does not add wallet execution, user private-key input, user fund movement, custody, automatic signing, or fabricated testnet state.

## Implemented architecture

The server adapter canonicalizes only the enforced structured intent fields and policy version, then uses Ethereum keccak256 for the intent, request, evidence, and receipt identity commitments. The natural-language source text is not a policy commitment field. Request and evidence commitments use structured RPC-derived and deterministic-policy data, with evidence rows ordered by stable ID.

The `commitPolicy` procedure uses the server evaluator address as the policy committer. It verifies Base Sepolia chain ID and registry bytecode, derives the policy ID from committer, nonce, hash, and version, waits for one confirmation, and reads back the on-chain policy before returning `COMMITTED`.

The `anchorReceipt` procedure re-inspects the Base Mainnet transaction rather than trusting a client-supplied verdict. It refuses to continue when the transaction or mined receipt is unavailable, validates that the canonical intent hash equals the active policy hash, verifies the evaluator role, constructs the exact EIP-712 Receipt schema, signs with the server-only evaluator, recovers the signature locally, waits for the anchoring transaction confirmation, and reads the receipt back before returning `ANCHORED`.

The `/app` interface keeps Base Mainnet verification separate from Base Sepolia attestation. It renders `NOT COMMITTED`, `NOT SIGNED`, and `NOT ANCHORED` until a real server result exists. It only displays commitment or anchor transaction links after the corresponding confirmed response is returned.

## Security limitations and operational status

The verifier remains read-only with respect to the user. IntentGuard does not request the transaction sender’s wallet connection, private key, seed phrase, or signature, and it cannot execute, block, or reverse the observed Base Mainnet transaction.

The cryptographic receipt attests to deterministic evaluation of observable data; it is not a guarantee that a target contract is safe, that a current quote equals historical execution, or that a user will not sign a different transaction elsewhere. The server evaluator is a service infrastructure role, not a substitute for the independent receipt subject.

The trust loop is intentionally unavailable until `BASE_SEPOLIA_RPC_URL`, `EVALUATOR_PRIVATE_KEY`, `POLICY_REGISTRY_ADDRESS`, and `RECEIPT_REGISTRY_ADDRESS` are configured. Missing or invalid configuration produces a precondition failure without network fallback, synthetic signature, transaction hash, or receipt status. The project currently has no configured Base Sepolia deployment, so live policy commitment, evaluator signing, receipt anchoring, and testnet smoke validation remain pending.

The deployment entrypoint is `scripts/deploy.cjs`, which is compatible with the configured CommonJS Hardhat runner. It fails locally before any deployment attempt unless the Base Sepolia RPC URL, deployer key, public admin, public evaluator, and evaluator key are all supplied and internally consistent. This preflight does not replace a real testnet deployment, bytecode verification, role verification, or smoke test.

## Validation completed

The revised Hardhat suite has 9 passing tests, covering independent subject anchoring, active and revoked policies, evaluator signature checks, replay protection, subject revocation, pause control, expiry, invalid receipt validity windows, and target-manager access control. The application suite has 16 passing Vitest tests, including deterministic canonicalization, the exact receipt type hash, evaluator recovery, the missing-runtime-configuration fail-closed boundary, and the missing-deployment-configuration preflight. TypeScript and production builds complete successfully.
