# Base v0.1 integration notes

## Audit findings

IntentGuard is currently a React 19 + Tailwind 4 static frontend with Wouter routing, a lightweight theme provider, a prebuilt UI component library, a Vite development server, and an Express static production server. The existing landing page is implemented in `client/src/pages/Home.tsx`, the route switch is in `client/src/App.tsx`, global design tokens and Forensic Signal styling are in `client/src/index.css`, and generated visual assets are referenced through `/manus-storage/...` lifecycle URLs.

There is no Base integration, no transaction schema, no policy engine, no API route, and no test suite in the current project. Authentication and database infrastructure are not required for the first verification workflow. The existing Vite configuration already has a server-side environment boundary for storage proxying, but the static production server has no Base-specific API boundary; a real server-side integration is therefore required before a deployed application can safely call a provider-backed RPC endpoint.

## Confirmed Base facts

| Fact | Decision | Source |
|---|---|---|
| Base Mainnet chain ID | `8453` / hexadecimal `0x2105` | [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base) and [Base `eth_chainId`](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId) |
| Base Mainnet RPC | `https://mainnet.base.org` for the first working adapter | [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base) |
| Base public endpoint limitation | HTTP-only and rate-limited; production traffic should use a node provider | [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base) |
| Mined transaction evidence | `eth_getTransactionReceipt` returns a receipt or `null`; pending transactions may return `null` | [Base `eth_getTransactionReceipt`](https://docs.base.org/base-account/reference/core/provider-rpc-methods/eth_getTransactionReceipt) |
| Canonical Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) |
| Base WETH9 | `0x4200000000000000000000000000000000000006` | [Base contract addresses](https://docs.base.org/base-chain/network-information/base-contracts) |

## Smallest real architecture

The first implementation will avoid authentication and persistence. It will add a focused backend boundary for live RPC reads and keep the policy engine as pure deterministic TypeScript that can be tested independently. The frontend will send a validated intent plus a real transaction hash or explicitly supported proposal input to the backend. The backend will retrieve observable transaction data from Base, decode the fields that are actually present, run the deterministic checks, and return evidence rows plus one of `MATCH`, `MISMATCH`, or `UNVERIFIABLE`.

The MVP will not invent a transaction proposal. The user can inspect a real Base transaction hash. A wallet proposal/signing flow will remain confirm-first and will not be added until the transaction shape and approval boundary are real. Missing receipts, unsupported calldata, unavailable simulation, and provider errors will remain explicit `UNVERIFIABLE` states.

## Initial supported intent schema

The first parser will support the specified natural-language swap and transfer forms through a deterministic, schema-validated parser. It will extract only claims it can prove from the supported syntax: chain, action, input asset, output asset, maximum spend, maximum slippage, unlimited-approval policy, and transfer recipient/amount where present. Unsupported wording will return a validation error instead of silently creating a broader policy.

## Security boundary

No private key, seed phrase, signing capability, or API secret will be accepted by the frontend. The final verdict will never be produced by an LLM. If AI is introduced later for explanation or parsing, its output will be validated against the same deterministic schema before policy evaluation.

## Managed template scope boundary

The project uses the managed server template only to expose a typed public tRPC boundary for read-only Base RPC inspection. The auto-provisioned OAuth, user, and Drizzle database modules remain template infrastructure; the v0.1 public workflow does not read or write application database records, ask a visitor to sign in, expose account features, or store verification history. No schema migration is needed for this milestone.

## Configuration guidance

The live adapter defaults to the documented Base public RPC endpoint. `BASE_RPC_URL` is an optional server-side override for a production-grade node provider and must be managed as a project secret rather than committed. See [`environment.example.md`](./environment.example.md) for the non-sensitive configuration contract.

## Router token metadata boundary

For an allowlisted decoded router path, IntentGuard resolves each token’s `symbol()` and `decimals()` through independent read-only Base `eth_call` requests at the latest state. ERC-20 identifies both metadata methods as optional, so a failed, malformed, or out-of-range response remains an explicit unavailable metadata state and leaves the transaction amount in raw units. It is never replaced with a guessed token name or assumed decimals. [4]

## Router evidence enhancement decision

The v0.1.1 enhancement will support **one allowlisted integration only**: Uniswap v3 `SwapRouter02` on Base Mainnet at `0x2626664c2603336E57B271c5C0b26F421741e481`. This deployment is listed by Uniswap for Base alongside `QuoterV2` at `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` and Base WETH at `0x4200000000000000000000000000000000000006`. [1]

The decoder will support only the documented `exactInputSingle` shape for a USDC-to-WETH single-hop path. Its observable tuple fields are `tokenIn`, `tokenOut`, `fee`, `recipient`, `amountIn`, `amountOutMinimum`, and `sqrtPriceLimitX96`. Every other router, selector, path type, and malformed tuple will remain explicit `UNVERIFIABLE` evidence rather than being heuristically decoded. [2]

For an allowlisted `exactInputSingle`, the application may request a contemporaneous `eth_call` to the allowlisted `QuoterV2` using the decoded input token, output token, amount in, pool fee, and price limit. `IQuoterV2.quoteExactInputSingle` returns an amount out, a post-quote square-root price, initialized ticks crossed, and a gas estimate. QuoterV2 is designed to calculate expected swap amounts without executing the swap; its quote is a **read-only estimate at the current chain state**, not a mined execution result, a guarantee, or a substitute for a price-oracle slippage policy. [3]

The live Base transaction `0x89e0bcc982a5d661f45d12f537615dea9d8c2cadc036de7f744b77a95478be33` was confirmed as a direct call to the allowlisted router with selector `0x04e45aaf`, the Base SwapRouter02 `exactInputSingle` ABI shape. Its decoded direction is WETH to USDC, so it is suitable for decoder and quote validation but not for the USDC-to-WETH policy-match demonstration.

### References

1. [Uniswap v3 Base deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments)
2. [Uniswap `IV3SwapRouter` interface](https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol)
3. [Uniswap `IQuoterV2` interface](https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/IQuoterV2.sol) and [QuoterV2 source](https://github.com/Uniswap/v3-periphery/blob/main/contracts/lens/QuoterV2.sol)
4. [ERC-20 optional `symbol` and `decimals` methods](https://eips.ethereum.org/EIPS/eip-20)
