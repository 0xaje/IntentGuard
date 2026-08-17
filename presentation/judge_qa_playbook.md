# IntentGuard Adversarial Judge Q&A Playbook

**Canonical Definition**:
> *IntentGuard is a deterministic intent-verification and attestation layer for AI agent transactions on Base. It compares human-declared constraints with observable transaction behavior and produces a cryptographically verifiable verdict before or after execution, depending on available evidence.*

**Core Thesis**: Pre-execution (*Can this proposed transaction safely proceed?*) and Post-execution (*Did the transaction that actually executed remain consistent?*) are **fundamentally different security problems**. The current implementation is strongest at post-execution / transaction evidence verification alongside preflight QuoterV2 / calldata simulation checks.

### Formal Trust Boundary Invariants

IntentGuard does **NOT**:
1. **Hold user funds** (non-custodial; zero balance storage)
2. **Hold user private keys** (never touches key material or seed phrases)
3. **Execute transactions on behalf of users** (does not act as a relayer or sign for EOAs)
4. **Trust an LLM to determine the final verdict** (deterministic code decides; LLMs only format input schemas)
5. **Infer missing blockchain evidence** (never assumes unobserved data is safe)
6. **Convert unavailable evidence into approval** (fails closed on unknown or unreachable data)

## 1. Answering doctrine

Every answer should follow the same four-part pattern:

1. **Concede the valid limitation.** Do not pretend the MVP is more capable than it is.
2. **State the precise product boundary.** Explain what IntentGuard actually checks.
3. **Show the implementation proof.** Point to the decoder, deterministic rule, receipt, test, or contract.
4. **Close with the expansion path.** Explain how the limitation becomes a wallet, smart-account, simulation, or integration opportunity rather than a hidden weakness.

The best answer is short enough to say in 20–35 seconds. If a judge asks for detail, move from product explanation to implementation evidence rather than adding hype.

## 2. High-probability adversarial questions

| # | Judge objection | Recommended answer | Proof to show |
|---:|---|---|---|
| 1 | **“Do you claim full pre-execution protection?”** | “No. Pre-execution (‘Can this safely proceed?’) and post-execution (‘Did it execute as promised?’) are different security problems. Our engine is strongest today at post-execution evidence auditing and preflight calldata/quoter inspection. We do not pretend to hold an active mempool interceptor or private enclave; instead, we provide the deterministic verification and EIP-712 attestation primitives that agents, wallets, and smart accounts integrate.” | README two-stage architecture and UI boundary panel. |
| 2 | **“Isn’t this just Blockaid or a transaction simulator?”** | “Those systems are valuable security and simulation primitives. IntentGuard’s wedge is different: the user declares a goal and hard limits first, then we compare the decoded effect to that policy. We are not claiming to replace simulation; we are building the intent-fidelity and evidence layer that decides whether the action matches authorization.” | The intent panel beside the decoded allowance and `IG-APPROVE-001`. |
| 3 | **“You say you block transactions, but an EOA can sign elsewhere. Isn’t that misleading?”** | “Correct: the MVP does not and cannot universally stop an externally owned account from signing somewhere else. Our MVP blocks the integrated approval flow and returns a fail-closed decision before confirmation. Universal enforcement requires a smart account, Safe module, wallet integration, or programmable execution layer, which we deliberately exclude from this non-custodial MVP.” | Safety-boundary slide and README limitation. |
| 4 | **“Where is the AI? This sounds like deterministic code.”** | “That separation is intentional. The agent uses AI to normalize natural-language intent and choose which evidence checks to investigate. The binding verdict is deterministic so the model cannot hallucinate an address, amount, or safety score. The model explains; the policy engine decides.” | Architecture slide: LLM has no-authority dotted edge; policy engine is authority. |
| 5 | **“What exact transactions do you support today?”** | “The verified MVP supports native transfers with value, ERC-20 approvals and supported permit evidence (`transfer`, `approve`, ERC-2612 typed `Permit`), and allowlisted Uniswap V3 `SwapRouter02.exactInputSingle` routes. Permit2 and arbitrary nested multi-calls are not claimed in this core package and fail closed as `CANNOT_VERIFY`.” | TypeScript decoder, fixture tests, and supported-scope README. |
| 6 | **“Can a malicious contract hide an approval inside a router call?”** | “In the current core package, an unsupported nested route is not decoded as safe; it becomes `CANNOT_VERIFY`. We do not issue `MATCH` for unknown nested effects. The next integration is a verified-ABI plus trace/simulation adapter that inspects nested asset deltas.” | Unknown-selector fixture and fail-closed rule. |
| 7 | **“Can a user or dApp manipulate token metadata or prompt the model?”** | “Metadata is not decision authority. Addresses and raw integer values are authoritative; symbols and names are display evidence. The model output is schema-validated and cannot change the deterministic result. Prompt-injection text is treated as untrusted data, not instructions.” | Trust-boundary slide and policy-engine code path. |
| 8 | **“What if the RPC is stale or compromised?”** | “We record chain ID and evidence source. Critical reads should be pinned to a block reference and cross-checked against a second provider in production. If required evidence disagrees or is unavailable, the verdict is `CANNOT_VERIFY`, never `MATCH`.” | Evidence schema, block reference fields, and uncertainty outcome. |
| 9 | **“Why should I trust your evaluator key?”** | “The evaluator is not a safety oracle; it attests that a specific engine version produced a result over specific hashes. The receipt registry gates evaluator roles, binds the EIP-712 signature to the contract and chain, enforces expiry, and supports revocation. Production control belongs behind a multisig and key rotation.” | `EVALUATOR_ROLE`, EIP-712 receipt, expiry/revocation tests. |
| 10 | **“Why anchor anything on-chain if the analysis is off-chain?”** | “The analysis needs RPCs, decoding libraries, and a fast UX. The chain is used for tamper-evident commitments: policy hash, request hash, evidence hash, evaluator identity, expiry, and revocation. The registry stores no user funds and makes no arbitrary calls.” | Receipt structure and registry contracts. |
| 11 | **“Could your contract itself be drained?”** | “The MVP contracts do not hold ETH or ERC-20 balances, do not call user-supplied targets, and expose no generic executor. Their state is commitments and receipts. The main residual risks are admin/evaluator key management and incorrect off-chain evidence, which are addressed with roles, expiry, revocation, versioning, and fail-closed behavior.” | Contract code and balance invariant tests. |
| 12 | **“Is `MATCH` equivalent to safe?”** | “No. `MATCH` means the supplied request matched the supplied policy under the checks implemented by this engine version. It does not prove that the target contract is honest or bug-free, and it does not protect a user from signing elsewhere.” | UI limitation copy and receipt limitations. |
| 13 | **“What would you build next if you won?”** | “First, integrate verified-ABI nested-call decoding and read-only simulation. Second, add a wallet or smart-account adapter that can enforce the receipt policy in an explicit programmable account. Third, expose the receipt and policy interfaces as an Orion Agent Store service.” | Roadmap slide or closing answer. |

## 3. Deep technical follow-ups

### 3.1 “Can the EIP-712 domain be spoofed?”

Answer: “The typed-data domain is displayed and compared to the declared chain. The contract’s EIP-712 receipt domain binds evaluator attestations to the registry address and deployment chain. A token’s own domain is evidence about what the user may sign; it is not allowed to disappear behind a generic ‘sign message’ label. A mismatch in chain or verifying contract cannot produce a positive permit result.”

### 3.2 “Why is exact approval the default?”

Answer: “Because the user’s immediate spend is narrower than an indefinite future permission. The default policy is `EXACT_ONLY`; `BOUNDED` and `UNLIMITED_ALLOWED` require explicit user selection. Unlimited approval is not silently accepted just because a protocol is recognized.”

### 3.3 “Does the registry verify the receipt’s evidence contents?”

Answer: “The registry verifies structural integrity, signature, role, chain, policy ownership, expiry, and revocation. It stores hashes rather than re-running off-chain analysis. Independent verifiers can retrieve the canonical receipt and recompute the hashes. Separating evaluation from anchoring keeps the contract small and non-custodial.”

### 3.4 “What if the evaluator service lies?”

Answer: “A valid receipt proves that an authorized evaluator signed a particular result; it does not make that evaluator infallible. That is why evaluator roles are governance-controlled, receipts expire, revocation exists, the engine version is recorded, and the open-source policy engine can be independently rerun. A production version would add multiple evaluators or a quorum for high-value actions.”

### 3.5 “Does the MVP have simulation?”

Answer: “The architecture has a simulation adapter boundary, and queries read-only QuoterV2 for Uniswap V3 on Base. For general multi-step contracts, unsupported simulation evidence fails closed rather than fabricating certainty.”

## 4. Questions we should not answer with hype

Do not say that IntentGuard “guarantees safety,” “stops all drainers,” “prevents every malicious contract,” “blocks all EOA signatures,” “replaces Blockaid,” or “has zero false negatives.” Those claims are technically indefensible and would undermine the strongest part of the pitch: precise, accountable scope.

## 5. Two-minute rapid-fire rehearsal

The presenter should be able to answer these five questions in sequence without opening code:

1. **What does it do?** “IntentGuard is a deterministic intent-verification and attestation layer for AI agent transactions on Base. It compares human constraints with observable transaction behavior and produces a cryptographically verifiable verdict before or after execution, depending on available evidence.”
2. **What are the two stages?** “Pre-execution asks ‘Can this safely proceed?’ and post-execution asks ‘Did it execute as declared?’ They are different security problems.”
3. **Where is the AI?** “AI normalizes and explains; deterministic code decides.”
4. **What if it cannot decode?** “`CANNOT_VERIFY` or `MISMATCH`; it fails closed.”
5. **Why should Orion care?** “Every agent that asks a human to approve value movement can reuse the policy and receipt layer.”

## 3. Deep technical follow-ups

### 3.1 “Can the EIP-712 domain be spoofed?”

Answer: “The typed-data domain is displayed and compared to the declared chain. The contract’s EIP-712 receipt domain binds evaluator attestations to the registry address and deployment chain. A token’s own domain is evidence about what the user may sign; it is not allowed to disappear behind a generic ‘sign message’ label. A mismatch in chain or verifying contract cannot produce a positive permit result.”

### 3.2 “Why is exact approval the default?”

Answer: “Because the user’s immediate spend is narrower than an indefinite future permission. The default policy is `EXACT_ONLY`; `BOUNDED` and `UNLIMITED_ALLOWED` require explicit user selection. Unlimited approval is not silently accepted just because a protocol is recognized.”

### 3.3 “Does the registry verify the receipt’s evidence contents?”

Answer: “The registry verifies structural integrity, signature, role, chain, policy ownership, expiry, and revocation. It stores hashes rather than re-running off-chain analysis. Independent verifiers can retrieve the canonical receipt and recompute the hashes. Separating evaluation from anchoring keeps the contract small and non-custodial.”

### 3.4 “What if the evaluator service lies?”

Answer: “A valid receipt proves that an authorized evaluator signed a particular result; it does not make that evaluator infallible. That is why evaluator roles are governance-controlled, receipts expire, revocation exists, the engine version is recorded, and the open-source policy engine can be independently rerun. A production version would add multiple evaluators or a quorum for high-value actions.”

### 3.5 “Does the MVP have simulation?”

Answer: “The architecture has a simulation adapter boundary, but the core implementation delivered for the MVP is strongest on deterministic decoding and policy checks. We do not claim a live simulation result where no simulator is wired. Unsupported or unavailable simulation evidence contributes to `CANNOT_VERIFY`.”

## 4. Questions we should not answer with hype

Do not say that IntentGuard “guarantees safety,” “stops all drainers,” “prevents every malicious contract,” “blocks all EOA signatures,” “replaces Blockaid,” or “has zero false negatives.” Those claims are technically indefensible and would undermine the strongest part of the pitch: precise, accountable scope.

## 5. Two-minute rapid-fire rehearsal

The presenter should be able to answer these five questions in sequence without opening code:

1. **What does it do?** “It verifies whether a proposed transaction or permit matches a user-declared intent before signing.”
2. **What is novel?** “Intent fidelity: comparing goal to effect, not only scoring the target.”
3. **Where is the AI?** “AI normalizes and explains; deterministic code decides.”
4. **What if it cannot decode?** “`CANNOT_VERIFY`; it fails closed.”
5. **Why should Orion care?** “Every agent that asks a human to approve value movement can reuse the policy and receipt layer.”

## References

[1]: https://orionagents.org/hackathon "Orion Builder Hackathon — official rules and judging"

[2]: https://orionagents.org/docs "Orion Agents Documentation — vetting, risk management, and reputation"

[3]: https://eips.ethereum.org/EIPS/eip-712 "EIP-712: Typed Structured Data Hashing and Signing"

[4]: https://eips.ethereum.org/EIPS/eip-2612 "ERC-2612: Permit Extension for EIP-20 Signed Approvals"

[5]: https://docs.soliditylang.org/en/latest/security-considerations.html "Solidity Security Considerations"
