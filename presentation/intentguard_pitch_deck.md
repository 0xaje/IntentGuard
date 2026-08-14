# IntentGuard — Orion Builder Hackathon Pitch

## Cover
**IntentGuard**  
**The transaction-intent firewall for autonomous finance**  
Orion Builder Hackathon · Base · Read-only · Confirm-first

## Slide 1
### The wallet shows a request. It does not show intent.
- A user thinks: “Claim my airdrop.”
- The chain is asked: `approve(spender, uint256.max)`
- The dangerous gap is not only malicious code; it is **human intent versus on-chain effect**.

## Slide 2
### IntentGuard makes the mismatch impossible to miss.
- State the goal and hard limits in plain language.
- Decode the transaction or EIP-712 signature the wallet wants to sign.
- Return **MATCH**, **MISMATCH**, or **CANNOT VERIFY** with the exact violated rule.

## Slide 3
### One decision. Three outcomes. Zero false confidence.
- **MATCH — safe to review:** decoded effect satisfies every configured policy check.
- **MISMATCH — do not sign:** at least one hard limit is violated.
- **CANNOT VERIFY — do not sign yet:** critical evidence is missing; IntentGuard will not guess.

## Slide 4
### This is intent fidelity—not another risk score.
| Existing pattern | IntentGuard’s wedge |
|---|---|
| Token research dashboards | User goal becomes a typed policy |
| Wallet-health diagnostics | Proposed effect is compared to intent |
| Generic transaction security | Evidence is returned as a reusable agent receipt |
- Simulation and reputation remain valuable evidence sources.
- The decision question is: **does this action match what the human authorized?**

## Slide 5
### The agent investigates. Deterministic code decides.
- **Intent normalizer:** converts language into explicit limits.
- **Decoder + evidence fetcher:** reads calldata, EIP-712 fields, Base state, and target metadata.
- **Policy engine:** applies typed rules; the model cannot change the verdict.
- **Explanation + receipt:** makes the result human-readable and independently verifiable.

## Slide 6
### Safety is a product feature—and a trust boundary.
- Read-only and confirm-first: no custody, private keys, signing, or broadcasting.
- Fail closed: unknown selectors and unavailable simulation become `CANNOT_VERIFY`.
- No arbitrary execution: contracts store commitments and receipts, not user funds.
- Honest scope: the MVP does not claim to universally block an externally owned account.

## Slide 7
### The demo proves the product in under 90 seconds.
| Scenario | Expected result | Judge-visible proof |
|---|---|---|
| Exact approval | **MATCH** | Token, spender, chain, and amount agree |
| Unlimited approval | **MISMATCH** | `uint256.max` violates exact-approval policy |
| EIP-2612 permit | **MISMATCH** | Spender, value, deadline, nonce, and domain are decoded |
| Unknown selector | **CANNOT VERIFY** | Missing ABI is surfaced instead of guessed |

## Slide 8
### Every verdict leaves a verifiable trail.
- Versioned evidence: intent hash, request hash, evidence hash, engine, decoder, block reference.
- `IntentGuardPolicyRegistry`: user-owned policy commitments and revocation.
- `IntentGuardReceiptRegistry`: evaluator-signed EIP-712 receipt with expiry and revocation.
- Base Sepolia anchor for the public demo; no token custody and no arbitrary external calls.

## Slide 9
### Built for Orion’s agent economy.
- A reusable pre-signing trust layer for Orion agents, launchpads, wallets, and Base dApps.
- Strong fit for risk management: explicit limits, traceable decisions, and circuit-breaker behavior.
- Economic wedge: API or integration revenue from agents and products that need safer autonomous actions.
- Store-ready positioning: **“Before value moves, prove the action matches intent.”**

## Slide 10
### We win by being the agent that refuses to guess.
- Useful: prevents a costly, understandable signing mistake.
- Executed: live no-wallet demo, deterministic engine, tests, and verified contracts.
- Original: intent-to-effect verification instead of a generic “safe” label.
- Ask: integrate IntentGuard anywhere an autonomous agent asks a user to approve value movement.

## Slide 11
### Autonomous finance earns trust by proving what it means.
**IntentGuard**  
The transaction-intent firewall for autonomous finance.  
Live demo · Open-source engine · Base receipts · Orion-ready
