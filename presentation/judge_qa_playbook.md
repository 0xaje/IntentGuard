# IntentGuard Adversarial Judge Q&A Playbook

**Purpose:** Pressure-test the hackathon defense against technical, security, product, and commercialization objections.

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
| 1 | **“Isn’t this just Blockaid or a transaction simulator?”** | “Those systems are valuable security and simulation primitives. IntentGuard’s wedge is different: the user declares a goal and hard limits first, then we compare the decoded effect to that policy. We are not claiming to replace simulation; we are building the intent-fidelity and evidence layer that decides whether the action matches authorization.” | The intent panel beside the decoded allowance and `IG-APPROVE-001`. |
| 2 | **“You say you block transactions, but an EOA can sign elsewhere. Isn’t that misleading?”** | “Correct: the MVP does not and cannot universally stop an externally owned account from signing somewhere else. Our MVP blocks the integrated approval flow and returns a fail-closed decision before confirmation. Universal enforcement requires a smart account, Safe module, wallet integration, or programmable execution layer, which we deliberately exclude from this non-custodial MVP.” | Safety-boundary slide and README limitation. |
| 3 | **“Where is the AI? This sounds like deterministic code.”** | “That separation is intentional. The agent uses AI to normalize natural-language intent and choose which evidence checks to investigate. The binding verdict is deterministic so the model cannot hallucinate an address, amount, or safety score. The model explains; the policy engine decides.” | Architecture slide: LLM has no-authority dotted edge; policy engine is authority. |
| 4 | **“What exact transactions do you support today?”** | “The verified MVP supports native transfers with value, ERC-20 `transfer`, ERC-20 `approve`, and ERC-2612-style `Permit` typed data. Unknown selectors fail closed. Generic router swaps and arbitrary nested calls are not claimed as production-supported in this core package.” | TypeScript decoder, fixture tests, and supported-scope README. |
| 5 | **“Can a malicious contract hide an approval inside a router call?”** | “In the current core package, an unsupported nested route is not decoded as safe; it becomes `CANNOT_VERIFY`. We do not issue `MATCH` for unknown nested effects. The next integration is a verified-ABI plus trace/simulation adapter that inspects nested asset deltas.” | Unknown-selector fixture and fail-closed rule. |
| 6 | **“Can a user or dApp manipulate token metadata or prompt the model?”** | “Metadata is not decision authority. Addresses and raw integer values are authoritative; symbols and names are display evidence. The model output is schema-validated and cannot change the deterministic result. Prompt-injection text is treated as untrusted data, not instructions.” | Trust-boundary slide and policy-engine code path. |
| 7 | **“What if the RPC is stale or compromised?”** | “We record chain ID and evidence source. Critical reads should be pinned to a block reference and cross-checked against a second provider in production. If required evidence disagrees or is unavailable, the verdict is `CANNOT_VERIFY`, never `MATCH`.” | Evidence schema, block reference fields, and uncertainty outcome. |
| 8 | **“Why should I trust your evaluator key?”** | “The evaluator is not a safety oracle; it attests that a specific engine version produced a result over specific hashes. The receipt registry gates evaluator roles, binds the EIP-712 signature to the contract and chain, enforces expiry, and supports revocation. Production control belongs behind a multisig and key rotation.” | `EVALUATOR_ROLE`, EIP-712 receipt, expiry/revocation tests. |
| 9 | **“What stops an admin from publishing a fake target as recognized?”** | “The target registry is curated metadata, not a safety guarantee. It cannot turn a contradictory request into `MATCH`. Changes are versioned and emitted as events; production governance should use a multisig and public review.” | Target registry status semantics and event log. |
| 10 | **“Why anchor anything on-chain if the analysis is off-chain?”** | “The analysis needs RPCs, decoding libraries, and a fast UX. The chain is used for tamper-evident commitments: policy hash, request hash, evidence hash, evaluator identity, expiry, and revocation. The registry stores no user funds and makes no arbitrary calls.” | Receipt structure and registry contracts. |
| 11 | **“Could your contract itself be drained?”** | “The MVP contracts do not hold ETH or ERC-20 balances, do not call user-supplied targets, and expose no generic executor. Their state is commitments and receipts. The main residual risks are admin/evaluator key management and incorrect off-chain evidence, which are addressed with roles, expiry, revocation, versioning, and fail-closed behavior.” | Contract code and balance invariant tests. |
| 12 | **“What is the false-positive or false-negative rate?”** | “We do not claim a production rate from a hackathon fixture set. The MVP is intentionally narrow and deterministic. For unsupported effects, we choose `CANNOT_VERIFY` rather than pretending to measure safety. The production measurement plan is a labeled corpus of approvals, permits, nested calls, and benign actions with independent review.” | Test matrix and explicit limitation statement. |
| 13 | **“Is `MATCH` equivalent to safe?”** | “No. `MATCH` means the supplied request matched the supplied policy under the checks implemented by this engine version. It does not prove that the target contract is honest or bug-free, and it does not protect a user from signing elsewhere.” | UI limitation copy and receipt limitations. |
| 14 | **“Why would a wallet or agent integrate you instead of building this?”** | “The reusable asset is the policy and receipt interface: typed intent, deterministic reason codes, EIP-712 receipts, and Base-verifiable commitments. Integrators can bring their own simulation or threat intelligence and still use IntentGuard as the intent-to-effect decision layer.” | API/schema and smart-contract interface. |
| 15 | **“Who pays?”** | “The initial customer is an agent, launchpad, wallet, or Base dApp that wants safer confirmation and audit evidence. The MVP monetization path is API or integration revenue, with a usage-based or platform-license model. We deliberately did not launch a token to create artificial economics.” | Orion integration slide and submission strategy. |
| 16 | **“What is the moat?”** | “The moat is not a blacklist. It is a reusable intent schema, policy corpus, labeled evidence history, integration surface, and receipts that let multiple agents prove action fidelity. Over time, the system becomes better at recognizing legitimate intent and safer default policies without giving up deterministic authority.” | Policy schema, receipt registry, and roadmap. |
| 17 | **“What happens when the user’s natural-language intent is ambiguous?”** | “The normalizer must ask for clarification or produce a deliberately narrow policy. It may not silently invent a chain, address, or amount. If ambiguity remains in the proposed request, the engine returns `CANNOT_VERIFY`.” | Intent schema and clarification state. |
| 18 | **“Can a receipt be replayed or become stale?”** | “Receipt IDs are unique, EIP-712 binding includes chain and verifying contract, and receipts expire. A revoked policy or receipt makes `isReceiptValid` false. The UI must never present an expired receipt as current.” | Receipt registry tests and expiry fields. |
| 19 | **“Why Base?”** | “Base is the target chain for the Orion entry and gives us a focused, credible scope. The contracts are chain-bound, and the evaluator and receipts are deployed per network. Multi-chain support is a later adapter problem, not a reason to make the first demo unreliable.” | Base chain ID configuration and deployment manifest. |
| 20 | **“What would you build next if you won?”** | “First, integrate verified-ABI nested-call decoding and read-only simulation. Second, add a wallet or smart-account adapter that can enforce the receipt policy in an explicit programmable account. Third, expose the receipt and policy interfaces as an Orion Agent Store service.” | Roadmap slide or closing answer. |

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
