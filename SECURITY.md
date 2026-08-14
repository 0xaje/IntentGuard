# Security Policy

## Security posture

IntentGuard is a hackathon MVP for read-only transaction-intent analysis. It is **not audited** and must not be used as a custody system, transaction executor, wallet replacement, or guarantee that a transaction is safe.

The repository’s smart contracts are intentionally non-custodial. They store policy commitments, target metadata, and signed evidence receipts; they do not hold ETH or ERC-20 assets and do not make arbitrary external calls.

## Supported scope

The current core implementation supports native transfers, ERC-20 `transfer`, ERC-20 `approve`, and ERC-2612-style `Permit` typed data. Unsupported or incomplete effects should return `CANNOT_VERIFY`. Generic nested calls, universal EOA enforcement, and live simulation adapters are outside the current core scope.

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
