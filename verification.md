# IntentGuard verification record

## Build checks

The initialized frontend completed `pnpm check` with no TypeScript errors and completed `pnpm build` successfully. The production build emitted only the standard Vite chunk-size advisory; no runtime or compile failure was reported.

## Browser checks

The live preview rendered the IntentGuard page with the expected title, brand mark, hero image, three supporting visuals, navigation labels, and footer copy. The Method navigation anchor moved the page to `#method` and displayed the operating-method section in the live browser.

Desktop and mobile screenshot passes were completed. The mobile layout collapsed the navigation behind the menu control, preserved readable contrast, and stacked the editorial sections without horizontal overflow in the captured viewport.

## Content integrity

The page uses only authored product language and generated visual assets. It does not present fabricated customer testimonials, ratings, reviews, usage metrics, or simulated live data.

## v0.1 live workflow checks

After the managed server upgrade, the public `/app` workflow loaded with **Base Mainnet Live RPC** status. The supported swap intent, `Swap $100 USDC for ETH on Base. Maximum slippage 1%. Don't allow unlimited approvals.`, was submitted through the live tRPC parser and rendered as schema-validated structured constraints: Base chain, swap action, 100 USDC maximum spend, ETH target, 1% maximum slippage, and an unlimited-approval block.

The workflow did not expose a wallet signing control, private-key input, seed-phrase input, or fabricated transaction result during this check.

## Live Base transaction evidence checks

IntentGuard successfully inspected real Base Mainnet transaction `0x2c1e5439c434f99d6b4f2023e4fe42ee0a1c8e5299ccf74ff3310b3a4cccecad` through the public Base RPC and its mined receipt. The limited decoder could not establish the swap router action, spend, slippage, or ETH output, so the product returned **UNVERIFIABLE** with explicit unavailable evidence rather than a pass.

The critical mismatch path was verified with real Base Mainnet transaction `0x030dc80b7b16652f214da3f3a16532f09e4dfe72b2bf765ffb9894c677ff2e1b`. The receipt exposed a USDC Approval event with the maximum uint256 allowance for spender `0xa5e1a81738259256181f9a0e478188553062d340`. When compared against the parsed policy that prohibits unlimited approvals, the deterministic engine returned **MISMATCH** with one failed approval check, no wallet approval, and a BaseScan transaction link.

After the contract-evidence and human-review update, the live parser was retested and again rendered the expected schema-validated Base swap constraints before any transaction request was enabled.

The browser hot-reload cycle cleared the prior transaction verdict as expected. The fresh page retained the parsed constraint review and live RPC indicator; no new verdict was recorded until a new verification request completes.

The completed post-update browser run again inspected transaction `0x030dc80b7b16652f214da3f3a16532f09e4dfe72b2bf765ffb9894c677ff2e1b` and returned **MISMATCH**. The evidence now includes an explicit unavailable destination-contract comparison, while preserving the failed unlimited-approval check. The human-review section rendered **Approval unavailable** and stated that a conflict with an explicit constraint blocks approval. No signature request, wallet connection, or transaction submission control was exposed.

A DOM-level browser assertion confirmed that the mismatch-state **Approval unavailable** control has `disabled: true`.

## Final responsive and keyboard checks

Full-page desktop and 375px mobile screenshots were captured for both `/` and `/app` after all shared CSS and workflow changes. The landing page retained the Forensic Signal hierarchy, generated visual assets, responsive menu treatment, and real `Test an Agent Action` links. The `/app` screen retained a single-column mobile reading order: intent, constraints, confirmation boundary, transaction inspection, then evidence.

Keyboard validation confirmed that the landing page focus sequence reaches the Method link through the primary navigation. The real `Test an Agent Action` link was focused and activated using the Enter key, routing to `/app`; the loaded route then reported **Base Mainnet Live RPC**. The mismatch-state approval control remains disabled, so keyboard navigation cannot use it to initiate an approval, signature, or submission.

## Source-control delivery

The verified v0.1 milestone was committed as `e33464f` (`feat: add Base intent verification v0.1 workflow`) on branch `feature/base-intent-verifier-v0.1` and pushed without rewriting the existing GitHub default-branch history. The review URL is [github.com/0xaje/IntentGuard/pull/new/feature/base-intent-verifier-v0.1](https://github.com/0xaje/IntentGuard/pull/new/feature/base-intent-verifier-v0.1).

## Router evidence enhancement validation

The live Base transaction `0x89e0bcc982a5d661f45d12f537615dea9d8c2cadc036de7f744b77a95478be33` was inspected through the public `/app` workflow. IntentGuard correctly identified the official allowlisted Uniswap Base `SwapRouter02` destination and decoded the `exactInputSingle` selector `0x04e45aaf`, its token path, fee tier, recipient, and input amount. The decoded path was not USDC-to-WETH, so the policy correctly returned **UNVERIFIABLE**, not a fabricated match.

The read-only QuoterV2 call returned a contemporaneous Base estimate of `10.733711 USDC` for that observed router path. The interface labels it as a current quote, preserves the raw transaction and receipt fields behind a native expandable evidence disclosure, and states that it is neither mined-output evidence nor a guarantee. The native disclosure was opened through its summary control and confirmed to enter the expanded state.

The visual loading sequence was observed while the live RPC request was pending: transaction resolution, receipt inspection, allowlisted route decoding, read-only quotation, and deterministic policy comparison. Full-page screenshots confirmed the revised desktop layout and the mobile single-column layout; the latter preserves readable stage ordering, functional actions, and no horizontal overflow.

After replacing the prior illustrative sequence with a truthful in-flight state, the refreshed `/app` workflow again extracted the supported Base swap intent and displayed its schema-validated constraints before allowing transaction inspection.

The current loading presentation uses an indeterminate progress meter and lists the evidence operations that are pending as a single server request: transaction and chain retrieval, receipt inspection, allowlisted route decoding, read-only quotation, and deterministic comparison. It explicitly states that no individual stage is marked complete until the server returns the complete evidence payload.

The live expanded raw-evidence packet now displayed the full Base RPC transaction and receipt fields, decoded `exactInputSingle` parameters (tokens, fee, recipient, amount in, minimum output, and price limit), and full QuoterV2 request/result metadata (contract, method, selector, latest block tag, output amount, post-quote price, ticks crossed, and gas estimate).

After the token-metadata enhancement was loaded, the refreshed `/app` interface again accepted and schema-validated the supported Base swap intent before enabling live transaction inspection.

Live inspection of Base transaction `0x89e0bcc982a5d661f45d12f537615dea9d8c2cadc036de7f744b77a95478be33` now resolved the observed router path through read-only ERC-20 metadata calls. The input token was returned as `ETD` with `18` decimals and the output as `USDC` with `6` decimals, producing the displayed values `12.20055724120418304 ETD` and `10.969333 USDC`. The raw evidence packet exposed each address, metadata state, symbol, decimals, and the source details. The incompatible ETD-to-USDC path remained **UNVERIFIABLE**, preserving deterministic policy boundaries.

## Development command and integration audit

`npm run dev` was reproduced successfully. It starts the same `tsx watch server/_core/index.ts` development entrypoint as `pnpm dev`; it does not require a pre-built `dist` directory. The audit used port `3001` only because the managed preview already occupied port `3000`, and the expected long-running development server was stopped by the bounded test timeout. The frontend uses `httpBatchLink` to `/api/trpc`, the Express server mounts the typed `intentGuard` router at that path, and the browser has exercised the resulting server-side Base transaction, receipt, metadata, and quote calls.

## Cryptographic trust-loop interface validation

On 17 August 2026, the refreshed `/app` interface was exercised against the public Base RPC using the actual 32-byte Base hash `0x217aed864a2c2792395c1edfdfaeaee5795ccf5eef3871a5ef09a57d3db4a3d5`. Base RPC did not return a transaction object or receipt for that supplied hash, so IntentGuard rendered **CANNOT VERIFY**, not a fabricated approval or match. The interface showed a live BaseScan link, raw empty RPC evidence, and kept human approval disabled.

The new **Verification receipt** panel then displayed only truthful non-final states: **NOT COMMITTED**, **NOT GENERATED**, **NOT SIGNED**, and **NOT ANCHORED**. The panel states that a Base Sepolia policy or receipt status appears only after server submission, confirmation, and on-chain readback. No policy commitment, evaluator signature, receipt anchor, deployment address, or Base Sepolia transaction hash is recorded here because no live Base Sepolia infrastructure credentials or deployed registries have been supplied.

## Subject-separation implementation validation

The revised Solidity suite completed with **9 passing** Hardhat tests. It covers service-owned policy commitment and revocation, unrelated-revoker rejection, evaluator-role signature validation, receipt replay rejection, active-policy enforcement, the independent transaction-subject flow, subject receipt revocation, pause enforcement, explicit expiry handling, invalid receipt validity windows, and target-manager access control.

The application suite completed with **15 passing** Vitest tests. This includes canonical intent/request/evidence hashing, exact Receipt EIP-712 type-hash and evaluator recovery, decoder and policy tests, and a trust-loop configuration-boundary test. The configuration test proves that a policy commitment fails closed before any network call when `BASE_SEPOLIA_RPC_URL`, `EVALUATOR_PRIVATE_KEY`, `POLICY_REGISTRY_ADDRESS`, or `RECEIPT_REGISTRY_ADDRESS` is absent. TypeScript checking and the production build both completed successfully. The build emitted only Vite’s non-blocking chunk-size advisory.

## Paused Base Sepolia deployment readiness

The deployment entrypoint now uses the configured Hardhat-compatible CommonJS runner (`scripts/deploy.cjs`) rather than an ESM TypeScript entrypoint that Hardhat cannot load directly. Before obtaining a signer or deploying anything, it requires a Base Sepolia RPC URL, deployer private key, public admin address, public evaluator address, and evaluator private key; validates URL, private-key, and address shape; verifies that the evaluator address is derived from the evaluator key; and verifies the active Hardhat signer equals the configured deployer key.

An offline deployment-preflight test deliberately removes all deployment configuration and confirms that `hardhat run scripts/deploy.cjs --network baseSepolia` stops with `Missing required deployment configuration: BASE_SEPOLIA_RPC_URL` before writing a manifest or sending any transaction. The final local suite completed with **16 passing** Vitest tests, **9 passing** Hardhat tests, a successful TypeScript check, and a successful production build. No Base Sepolia credentials, registry addresses, or transaction hashes were created or claimed during this validation.
