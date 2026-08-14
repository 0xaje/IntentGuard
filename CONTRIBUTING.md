# Contributing to IntentGuard

IntentGuard’s canonical repository is [github.com/0xaje/IntentGuard](https://github.com/0xaje/IntentGuard).

## Delivery convention

All product changes must be made in the IntentGuard working tree, committed with a descriptive message, and pushed to the canonical `main` branch after verification. Do not treat a local-only change as delivered.

Before pushing, run the relevant checks for the changed area. For core changes, use:

```bash
pnpm test
```

For deployment or verification changes, also run the relevant TypeScript check and confirm that no `.env` file, private key, RPC credential, seed phrase, or local verification output is tracked by Git.

The canonical remote must remain:

```text
https://github.com/0xaje/IntentGuard.git
```

Keep secrets out of the repository. Use `.env.example` for documentation and local secret managers or environment variables for real credentials.
