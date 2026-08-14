# IntentGuard environment configuration

IntentGuard v0.1 needs **no wallet secret, private key, seed phrase, signer, or user-provided API key**. The server reads public Base transaction evidence only.

| Variable | Required | Purpose | Safe default |
|---|---:|---|---|
| `BASE_RPC_URL` | No | A server-side Base Mainnet JSON-RPC endpoint. Use a provider-managed endpoint for production traffic. | `https://mainnet.base.org` |

`BASE_RPC_URL` must be supplied through the project’s managed secret/configuration interface rather than committed to a local `.env` file. The project’s `.gitignore` excludes `.env*`, credentials, private keys, certificates, and local secrets.

> The application never accepts a signing credential. The Base RPC integration is read-only: it requests transaction, receipt, log, and network metadata in order to generate deterministic evidence.
