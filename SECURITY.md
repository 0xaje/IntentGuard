# Security Policy

## Security Posture & Trust Boundaries

IntentGuard is a deterministic intent-verification and attestation layer for AI agent transactions on Base.

### Explicit Trust Invariants
IntentGuard strictly adheres to the following non-custodial invariants. **IntentGuard does NOT:**
- **Hold user funds**: Zero token custody, no escrow contracts, and no balance storage.
- **Hold user private keys**: Never receives, stores, or requests mnemonic phrases or private keys.
- **Execute transactions on behalf of users**: Never broadcasts transactions for users or acts as a relayer.
- **Trust an LLM to determine the final verdict**: LLMs only assist in natural language normalization; all verdicts (`MATCH`, `MISMATCH`, `UNVERIFIABLE`) are strictly computed by deterministic TypeScript/Solidity policy code.
- **Infer missing blockchain evidence**: Missing RPC data or unmined states never default to success.
- **Convert unavailable evidence into approval**: Unknown selectors or unavailable RPC endpoints fail closed.

## Supported Scope

The current core implementation supports native transfers, ERC-20 approvals and supported permit evidence (`transfer`, `approve`, ERC-2612 typed `Permit`), and allowlisted Uniswap V3 `SwapRouter02.exactInputSingle` routes. Unsupported or incomplete effects return `CANNOT_VERIFY` / `UNVERIFIABLE`. Generic nested calls, universal EOA enforcement, and live simulation adapters are outside the current core scope.

## Reporting a vulnerability

Do not open a public issue with exploit instructions, private keys, signatures, RPC credentials, or a proof of concept that could put users at risk. Instead, contact the repository owner privately and include:

| Include | Why |
|---|---|
| A concise description of the issue | Enables accurate triage. |
| Affected file, contract, function, or commit hash | Makes the report reproducible. |
| A minimal non-destructive reproduction | Confirms the impact without harming users. |
| Assumptions and affected environment | Distinguishes a local configuration problem from a product issue. |
| A suggested mitigation, if available | Helps evaluate urgency and remediation options. |

The initial response target for a credible report is two business days. Do not disclose the issue publicly until the repository owner has acknowledged it and an appropriate remediation or disclosure plan exists.

## Operational guidance

Never commit `.env` files, private keys, seed phrases, provider credentials, or local verification output. Use dedicated low-balance testnet accounts during Base Sepolia deployment and remove compromised evaluator addresses from `EVALUATOR_ROLE` immediately if compromise is suspected.
