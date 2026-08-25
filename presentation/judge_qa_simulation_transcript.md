# IntentGuard Live Judge Q&A Simulation

**Format:** Three judges, rapid follow-ups, no slides beyond the closing frame.  
**Objective:** Test whether the team can stay precise under technical pressure without overclaiming.

## Round 1 — Differentiation and technical scope

**Judge 1 — Security:** “You call this a transaction-intent firewall. Why is this not just a smaller Blockaid?”

**Presenter:** “Blockaid and similar systems provide important simulation, threat intelligence, and transaction assessment primitives. Our wedge is intent fidelity. IntentGuard starts with the user’s declared goal and hard limits, decodes the proposed request, and evaluates whether the actual effect matches that policy. We are not replacing a simulator; we are building the intent-to-effect and evidence-receipt layer around it.”

**Judge 1:** “So if the simulator says a transaction looks okay but the user said ‘no approvals,’ what happens?”

**Presenter:** “The user policy wins. An approval violates the declared action and returns `MISMATCH`, even if the target is recognized. A recognized target can add evidence, but it cannot override a contradictory user constraint.”

**Judge 1:** “What does your MVP really decode?”

**Presenter:** “The core implementation decodes native transfers with value, ERC-20 `transfer`, ERC-20 `approve`, and ERC-2612-style `Permit` typed data. Unknown selectors fail closed. We do not claim that generic nested router calls are fully supported in this core package.”

## Round 2 — AI authority and false confidence

**Judge 2 — AI/agents:** “Where is the AI? The result seems deterministic.”

**Presenter:** “That is intentional. AI normalizes the user’s natural-language goal and can choose follow-up evidence checks. The typed decoder and policy engine produce the binding result. The explanation model receives the deterministic result and cannot alter the verdict, amount, address, or rule code. The model explains; deterministic code decides.”

**Judge 2:** “What if the intent parser hallucinates an amount or address?”

**Presenter:** “The normalized intent is schema-validated and shown to the user for confirmation. The model cannot silently invent an address, chain, or amount. If the constraint is ambiguous, the system asks for clarification or returns `CANNOT_VERIFY` rather than creating a broad policy.”

**Judge 2:** “Why not simply ask the model if the transaction is safe?”

**Presenter:** “Because ‘safe’ is an unbounded claim and the model may hide uncertainty. We use typed facts, hard policy rules, and three explicit outcomes. This gives us a reproducible decision rather than an attractive paragraph.”

## Round 3 — Enforcement and user safety

**Judge 3 — Protocol:** “Can you actually prevent an EOA from signing?”

**Presenter:** “Not universally, and we do not claim that. A normal receipt contract cannot stop an EOA from signing an unrelated request elsewhere. The MVP protects the approval flow it is integrated into. Universal enforcement requires a programmable account, Safe module, ERC-4337 account, or wallet adapter. We keep that boundary explicit because pretending otherwise would be a security flaw.”

**Judge 3:** “Then why call it a firewall?”

**Presenter:** “Because in the integrated confirmation path it acts as a fail-closed gate before the user proceeds. The product firewall is the decision boundary in the flow, not a claim that an unrelated wallet interface can be retroactively controlled.”

**Judge 3:** “What stops your contracts from becoming a new attack surface?”

**Presenter:** “The MVP contracts do not hold ETH or tokens, do not call user-supplied targets, and expose no generic executor. They store policy commitments and signed receipts. The main operational risks are admin and evaluator key management, which are handled with roles, expiry, revocation, monitoring, and a multisig path for production.”

## Round 4 — Evidence integrity and receipts

**Judge 1:** “Does the on-chain registry prove that your analysis was correct?”

**Presenter:** “No. It proves that an authorized evaluator signed a particular result over particular intent, request, and evidence hashes, at a particular time and engine version. That is an evidence attestation, not a safety oracle. Independent verifiers can recompute the hashes and inspect the open-source engine.”

**Judge 1:** “What if your evaluator key lies?”

**Presenter:** “A compromised evaluator can produce a false receipt, so evaluator authorization is not treated as infallibility. We constrain blast radius with a dedicated role, short receipt expiry, revocation, key rotation, engine versioning, and public auditability. A production high-value path should use multiple evaluators or a quorum.”

**Judge 1:** “Why not put the entire decision on-chain?”

**Presenter:** “The detailed analysis needs decoding libraries, provider reads, and a fast user experience. Putting the whole engine on-chain would increase cost and reduce flexibility. We anchor the integrity-critical commitments and keep the evidence available for independent recomputation.”

## Round 5 — Unknown calls and adversarial contracts

**Judge 2:** “What if a malicious router hides a transfer inside an otherwise normal call?”

**Presenter:** “If the nested effect is not decoded with sufficient evidence, the current core returns `CANNOT_VERIFY`; it does not return `MATCH`. The next adapter is verified-ABI nested decoding plus read-only simulation and asset-delta inspection. We prefer an explicit refusal over an unearned pass.”

**Judge 2:** “What if the contract changes behavior after your receipt?”

**Presenter:** “Receipts are short-lived and tied to an analysis block and engine version. A receipt describes what was checked at that point; it does not guarantee future contract behavior. The UI displays that limitation and never treats an expired receipt as current.”

## Round 6 — Business and Orion fit

**Judge 3:** “Who pays for this if wallets already have security vendors?”

**Presenter:** “The initial buyer is any agent, launchpad, wallet, or Base dApp that needs an intent policy and evidence layer around its existing security stack. The MVP path is API and integration revenue. We do not need to replace existing providers; we can consume their evidence while owning the policy and receipt interface.”

**Judge 3:** “What is the Orion-specific value?”

**Presenter:** “Orion is an agent economy where autonomous actions need user confirmation and accountability. IntentGuard makes that confirmation legible and auditable: the agent can show what it intends, the user can set limits, and the receipt records what was evaluated before value moved.”

**Judge 3:** “What would you build next?”

**Presenter:** “First, verified nested-call decoding and read-only simulation. Second, a wallet or smart-account adapter that can enforce a policy in an explicitly programmable account. Third, an Orion Agent Store service exposing policy creation, analysis, and receipt verification as reusable APIs.”

## Final pressure test

**Judge 1:** “Give us the one sentence we should remember.”

**Presenter:** “IntentGuard does not ask users to trust an AI’s confidence; it proves whether the requested action matches what the user meant—and refuses to guess when it cannot.”

## Self-scoring rubric

| Dimension | Pass condition |
|---|---|
| Precision | No unsupported claim about universal blocking, simulation coverage, or safety guarantees. |
| Brevity | Most answers land within 20–35 seconds. |
| Technical grounding | Each answer references a decoder, policy rule, receipt field, role, or explicit limitation. |
| Composure | The presenter concedes valid limitations without sounding defensive. |
| Product narrative | Answers return to intent fidelity, fail-closed behavior, and reusable integration. |
