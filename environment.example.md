# IntentGuard environment configuration

IntentGuard’s Base Mainnet verifier needs **no user wallet secret, private key, seed phrase, signer, or user-provided API key**. The server reads public Base transaction evidence only. The optional cryptographic trust loop uses separate, server-owned Base Sepolia infrastructure credentials; it never represents the infrastructure signer as the user’s transaction subject.

| Variable | Required | Purpose | Safe default |
|---|---:|---|---|
| `BASE_RPC_URL` | No | A server-side Base Mainnet JSON-RPC endpoint. Use a provider-managed endpoint for production traffic. | `https://mainnet.base.org` |
| `BASE_SEPOLIA_RPC_URL` | Required for trust-loop deployment/anchoring | Server-side Base Sepolia JSON-RPC endpoint used to deploy registries, commit policies, and anchor confirmed receipts. | None |
| `INTENTGUARD_DEPLOYER_PRIVATE_KEY` | Required for deployment only | Funded Base Sepolia account that deploys the registries and grants the evaluator role. | None |
| `INTENTGUARD_ADMIN` | Required for deployment | Public address receiving registry administrative, pauser, and target-manager roles. | None |
| `INTENTGUARD_EVALUATOR` | Required for deployment | Public address corresponding to the server evaluator key; receives `EVALUATOR_ROLE` on the receipt registry. | None |
| `EVALUATOR_PRIVATE_KEY` | Required for runtime anchoring | Server-only evaluator key that signs EIP-712 receipts after deterministic verification. It must derive to `INTENTGUARD_EVALUATOR`. | None |
| `POLICY_REGISTRY_ADDRESS` | Required for runtime anchoring | Confirmed Base Sepolia address of the deployed `IntentGuardPolicyRegistry`. | None |
| `RECEIPT_REGISTRY_ADDRESS` | Required for runtime anchoring | Confirmed Base Sepolia address of the deployed `IntentGuardReceiptRegistry`. | None |

All environment values must be supplied through the project’s managed secret/configuration interface rather than committed to a local `.env` file. The project’s `.gitignore` excludes `.env*`, credentials, private keys, certificates, local secrets, Solidity artifacts, and deployment manifests.

> The application never accepts a user signing credential. The Base Mainnet RPC integration is read-only: it requests transaction, receipt, log, and network metadata in order to generate deterministic evidence. When enabled, `EVALUATOR_PRIVATE_KEY` signs an attestation only after the referenced policy is active, the Base transaction has a confirmed receipt, the deterministic verdict has been calculated, local EIP-712 signature recovery succeeds, and the Base Sepolia anchor transaction is confirmed and read back from the registry.

At the time of this revision, no Base Sepolia registry addresses or deployment transaction hashes are recorded because credentials have not been configured. Do not set `POLICY_REGISTRY_ADDRESS` or `RECEIPT_REGISTRY_ADDRESS` until the revised registries have actually been deployed and their bytecode and role configuration have been verified.
