# IntentGuard v0.1 implementation checklist

## Audit and requirements

- [x] Read the complete attached v0.1 specification and map every requirement to a project task.
- [x] Inspect `ideas.md`, `verification.md`, `package.json`, source structure, environment handling, components, styling, and asset references.
- [x] Run the existing landing page and preserve the current successful build before feature work.
- [x] Preserve the Forensic Signal identity and avoid rebuilding the marketing page from scratch.

## Product scope

- [x] Build one Base-only end-to-end verification workflow.
- [x] Keep persistence, accounts, multi-chain support, wallet custody, agent marketplace, tokenomics, and unnecessary infrastructure out of the public v0.1 workflow.
- [x] Document and isolate the managed authentication and database scaffolding introduced solely to obtain the required server boundary; do not use it in the public v0.1 workflow.
- [x] Keep the final security verdict deterministic and never delegate it to an LLM.

## Intent composer and structured intent

- [x] Add a dedicated `/app` experience with a natural-language intent composer.
- [x] Add only examples that correspond to real supported workflows.
- [x] Parse supported intent language into a deterministic, schema-validated structured intent.
- [x] Display the interpreted constraints before verification.
- [x] Make unsupported or ambiguous requests explicit rather than silently guessing.

## Base integration and transaction inspection

- [x] Define Base network constants and load RPC/API configuration from environment variables.
- [x] Add a secure backend boundary if a secret-backed provider or server proxy is required.
- [x] Never expose private keys, seed phrases, or credentials in the frontend.
- [x] Accept or obtain a real Base-compatible transaction proposal without fabricating values.
- [x] Decode available chain ID, destination, selector/function, token, amount, approval, recipient, value, and calldata fields where observable.
- [x] Return `UNVERIFIABLE` when required evidence is unavailable instead of using a fake success.

## Deterministic verification

- [x] Implement explicit checks for chain, action, input asset, spend limit, slippage, approval, contract/recipient, and expected output where observable, with unavailable evidence called out explicitly.
- [x] Produce evidence rows with verified, failed, and unavailable states.
- [x] Restrict the final result to exactly `MATCH`, `MISMATCH`, or `UNVERIFIABLE`.
- [x] Allow a local human-review acknowledgement only after displaying the structured intent, decoded transaction, and evidence trail; block it for mismatch and unverifiable states.
- [x] Ensure human approval does not imply an on-chain submission unless a real wallet-confirmation flow is explicitly connected.

## UI integration

- [x] Update the landing-page primary CTA to `Test an Agent Action`.
- [x] Connect the CTA to the real `/app` workflow.
- [x] Keep the existing landing-page visual identity and responsive behavior.
- [x] Add clear loading, validation, error, empty, mismatch, and unverifiable states without fake fallback content.
- [x] Intentionally omit verification history because persistence would be unnecessary for v0.1 and any invented entries would violate the no-fake-data requirement.

## Verification and delivery

- [x] Run typecheck and production build after the secure backend upgrade baseline.
- [x] Test live Base reads and failure modes with real observable responses.
- [x] Test desktop and mobile layouts and keyboard-accessible approval/navigation states.
- [x] Update documentation and verification records with actual results.
- [x] Create and push one verified v0.1 feature-branch commit through the authenticated repository workflow without destructive history rewrites.
- [x] Save a final project checkpoint before delivery.

## Router evidence enhancement

- [x] Audit the existing Base RPC inspection, decoder, evidence payload, progress state, and evidence UI before extending the verifier.
- [x] Research one authoritative allowlisted Base swap-router integration and record the verified contract, ABI, and supported call paths.
- [x] Implement deterministic decoding only for the allowlisted router and return explicit unavailable evidence for all other routers or unsupported calldata.
- [x] Add only observable simulation evidence, clearly distinguishing a static call or quoted output from a mined receipt.
- [x] Add a truthful visual in-flight inspection state with an indeterminate meter and explicit pending evidence operations; do not claim individual server-stage completion before the complete response returns.
- [x] Add keyboard-accessible expandable raw-evidence details, including full transaction/receipt fields, decoded calldata parameters, and complete simulation source and result fields.
- [x] Test a real allowlisted Base router transaction, incompatible-path behavior, loading stages, evidence expansion, desktop/mobile layout, typecheck, tests, and production build.
- [x] Commit, push, and checkpoint the router evidence enhancement without destructive history rewrites.

## Development workflow and integration follow-up

- [x] Audit the `dev`, `build`, `start`, and test scripts and reproduce the reported npm development-command behavior.
- [x] Verify the live frontend-to-backend tRPC path from `/app` through the public intent verification procedure to Base RPC.
- [x] Do not add a redundant `npm run dev` alias: the existing `dev` script works through both npm and pnpm and starts the same Node/Express development entrypoint.
- [x] Identify and implement the next real Base verification enhancement after the integration audit.
- [x] Resolve decoded allowlisted-router path tokens through read-only ERC-20 `symbol` and `decimals` RPC calls, with explicit unavailable states for noncompliant contracts.
- [x] Display resolved router-path input/output labels and correctly scaled observable amounts without affecting deterministic verdict boundaries.
- [x] Test, commit, push, checkpoint, and document the development-workflow follow-up without destructive history rewrites.

## GitHub synchronization follow-up

- [x] Audit the current feature branch, remotes, working-tree changes, ahead/behind state, and protected-file exposure.
- [x] Commit any necessary unpushed project changes without staging ignored environment, credential, or generated files.
- [x] Push the complete verified feature branch to GitHub without rewriting remote history.
- [x] Record the final GitHub synchronization result and remote commit.

## Cryptographic trust-loop milestone

- [x] Audit existing Solidity registries, canonical hashing, EIP-712 receipt logic, shared contracts, tRPC routes, Base verification flow, configuration boundaries, and tests before changing code.
- [x] Document the audit: what already exists, what is missing, and the exact files that must change; do not duplicate current functionality.
- [x] Define one canonical IntentSpec serialization and Ethereum keccak256 intent hash including all enforced constraints and the policy version.
- [x] Add deterministic canonical hashes for request, evidence, and receipt identity using structured data only.
- [x] Match the existing Receipt Registry EIP-712 schema, field ordering, types, and domain exactly in TypeScript.
- [x] Implement server-only policy commitment, evaluator signing, local signature recovery, and receipt anchoring with clear missing-configuration failures.
- [x] Keep every policy, signature, and anchoring state fail-closed; never return a fabricated transaction, signature, confirmation, or receipt.
- [x] Extend the existing UI with real policy, verdict, evidence, attestation, and on-chain receipt states without redesigning the Forensic Signal interface.
- [x] Add unit, contract, integration, security-boundary, and Base Sepolia end-to-end tests only where existing contracts and credentials make real validation possible.
- [x] Update README, verification records, environment guidance, and architecture documentation with actual deployment and test evidence only.
- [ ] Commit, push, checkpoint, and document the cryptographic trust-loop milestone without destructive history rewrites.

## Approved subject-separation registry revision

- [x] Document the exact minimal change that authorizes independent transaction subjects under a valid service-owned policy without changing the receipt subject.
- [x] Preserve policy committer/owner, policy validity, revocation, replay protection, evaluator role separation, and receipt expiry in the revised contracts.
- [x] Bring the existing Solidity, engine, deployment, verification, and contract-test sources from the default branch into the feature branch without overwriting the live verifier.
- [x] Update Solidity interfaces, registry tests, canonical hashes, EIP-712 types, and server ABI use to bind policy ID, intent hash, request hash, evidence hash, independent subject, verdict, evaluator, expiry, and versions.
- [x] Implement server-only policy commitment, evaluator signing, local signature recovery, and confirmed receipt anchoring with explicit missing-configuration failures.
- [x] Extend the existing UI with truthful policy, signature, and anchoring states; no wallet execution or client-side keys.
- [ ] Configure and redeploy the revised registries to Base Sepolia with real credentials only, recording real addresses and transaction hashes only after confirmation.
- [ ] Run the complete contract, engine, TypeScript, application, security, and testnet validation suites.
- [x] Update architecture, trust boundaries, deployment guidance, verification records, and security limitations with actual results only.
- [ ] Commit, push, checkpoint, and deliver the subject-separation trust-loop milestone without force-pushing or rewriting history.
- [x] Add explicit subject-separation contract coverage for expired receipts and invalid receipt validity windows, then rerun the complete Hardhat suite.
- [ ] Implement and validate server-side ABI-backed registry calls that bind every canonical receipt field only after real confirmation.

## IDE startup diagnosis

- [x] Diagnose why `npm start` does not serve the IntentGuard frontend in the IDE and verify the correct local development command and URL.
- [x] Add only the minimal start-script or documentation change required to make the verified frontend startup path clear, then test, commit, push, and checkpoint it.
- [ ] Commit, push, and checkpoint the verified `start:local` script and IDE frontend-startup guidance.
