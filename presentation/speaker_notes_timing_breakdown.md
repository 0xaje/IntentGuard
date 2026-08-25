# IntentGuard Pitch Presentation
## Speaker Notes and Timing Breakdown

**Recommended pitch length:** 6 minutes 10 seconds  
**Recommended live demo segment:** 90 seconds inside the pitch or as the dedicated demo after Slide 7  
**Recommended Q&A reserve:** 4–6 minutes, depending on the hackathon format

The presenter should speak with calm technical confidence. The product is strongest when the team is precise about its scope: **the model explains, deterministic code decides; the MVP is read-only and confirm-first; unsupported evidence becomes `CANNOT_VERIFY`.**

## Timing map

| Slide | Title | Start | Duration | Delivery objective |
|---:|---|---:|---:|---|
| Cover | IntentGuard | 0:00 | 0:15 | Establish the memorable category and trust-first tone. |
| 1 | The wallet shows a request. It does not show intent. | 0:15 | 0:30 | Make the user-versus-chain mismatch concrete. |
| 2 | IntentGuard makes the mismatch impossible to miss. | 0:45 | 0:30 | Explain the three-step product flow. |
| 3 | One decision. Three outcomes. Zero false confidence. | 1:15 | 0:30 | Introduce the verdict system and fail-closed behavior. |
| 4 | This is intent fidelity—not another risk score. | 1:45 | 0:30 | Defend originality and avoid the “generic scanner” objection. |
| 5 | The agent investigates. Deterministic code decides. | 2:15 | 0:40 | Prove the architecture and the AI authority boundary. |
| 6 | Safety is a product feature—and a trust boundary. | 2:55 | 0:30 | Establish non-custody, no-arbitrary-execution, and honest scope. |
| 7 | The demo proves the product in under 90 seconds. | 3:25 | 1:00 | Preview the live sequence and set judge expectations. |
| 8 | Every verdict leaves a verifiable trail. | 4:25 | 0:30 | Show why receipts and Base anchoring matter. |
| 9 | Built for Orion’s agent economy. | 4:55 | 0:30 | Connect the product to partners and integration revenue. |
| 10 | We win by being the agent that refuses to guess. | 5:25 | 0:30 | Map proof to usefulness, execution, originality, and security. |
| 11 | Autonomous finance earns trust by proving what it means. | 5:55 | 0:15 | Deliver the memorable close and the integration ask. |

## Cover — 0:00–0:15

**Say:** “This is IntentGuard: the transaction-intent firewall for autonomous finance. Before a wallet signs, IntentGuard checks whether the action matches what the human actually meant.”

Do not explain the architecture yet. Let the three verdict labels on the cover establish the product’s shape. Hold for a beat after “transaction-intent firewall” so the category lands. The only supporting metadata needed is that this is a Base-targeted, read-only, confirm-first Orion entry.

**Transition:** “The reason this matters is that a wallet can show a perfectly valid request that is completely different from the user’s intent.”

## Slide 1 — 0:15–0:45

**Say:** “A user thinks, ‘Claim my airdrop. Do not grant permissions.’ The chain may receive `approve(spender, uint256.max)`: unlimited permission to move USDC. The danger is not only that the target might be malicious. The danger is that the request and the human’s belief are not the same thing.”

Point left first, then right. Do not read every UI label. The only fact judges need is the asymmetry: natural language expresses a goal, while the wallet popup expresses a low-level request. End with the slide’s question: “Does the proposed action match what the human meant?”

**If challenged:** “Yes, existing transaction scanners are valuable. Our specific problem is the authorization gap between intent and effect.”

**Transition:** “IntentGuard turns that gap into a typed comparison.”

## Slide 2 — 0:45–1:15

**Say:** “The flow is intentionally simple. First, the user states the goal and hard limits. Second, IntentGuard decodes calldata or typed data into fields such as token, spender, amount, deadline, and chain. Third, deterministic policy rules compare those fields to the declared intent.”

Use the three numbered stages as the pacing structure. The mismatch UI on the right is the visual payoff: the product is not merely generating a paragraph; it is making the human intent and on-chain effect visible beside each other. Emphasize that the model may help normalize language, but it cannot silently invent an address, amount, or chain.

**Transition:** “The comparison produces one of three states, and each state tells the user what to do next.”

## Slide 3 — 1:15–1:45

**Say:** “`MATCH` means the configured policy checks passed and the request is safe to review—not guaranteed safe in every possible sense. `MISMATCH` means a hard limit was violated: wrong spender, excess amount, wrong chain, or unlimited approval. `CANNOT VERIFY` means critical evidence is missing. IntentGuard refuses to guess.”

Say the action language exactly: “safe to review,” “do not sign,” and “do not sign yet.” The distinction between `MISMATCH` and `CANNOT_VERIFY` is central to the security thesis. A binary score hides uncertainty; this product surfaces it. Point to the cannot-verify wireframe and say that the product makes the known and unknown evidence explicit.

**Transition:** “That three-state model is also what separates IntentGuard from a generic risk score.”

## Slide 4 — 1:45–2:15

**Say:** “Token research answers what an asset or protocol is. Wallet diagnostics answer what risks already exist. Transaction security estimates what a request may do. IntentGuard adds a different decision question: does this action match what the human authorized?”

Do not attack competitors. Say that simulation, reputation, and threat intelligence remain useful evidence sources. The originality is the typed policy and intent-fidelity layer that sits on top of those sources. This framing prevents a judge from concluding that the product is an underpowered replacement for a mature security provider.

**Key line:** “We are not trying to win by being a smaller blacklist. We are trying to win by owning the authorization comparison.”

**Transition:** “That distinction is reflected in the architecture.”

## Slide 5 — 2:15–2:55

**Say:** “The architecture has a deliberate authority boundary. The intent normalizer turns language into a strict schema. The decoder reads calldata and EIP-712 typed data. Evidence adapters read Base state and registry metadata. The policy engine applies typed rules and produces the only binding verdict. The explanation layer receives the deterministic result; it cannot change the verdict.”

Trace the diagram from left to right and stop at the policy engine. Mention that the on-chain registries anchor policy commitments and receipts, while the detailed analysis remains off-chain for speed and flexibility. The key security sentence is: “The model explains; deterministic code decides.”

**If asked about simulation:** “The architecture has a simulation adapter boundary, but this core package does not claim a live simulation result where no simulator is wired. Missing critical evidence becomes `CANNOT_VERIFY`.”

**Transition:** “The same separation defines what the MVP refuses to do.”

## Slide 6 — 2:55–3:25

**Say:** “IntentGuard is read-only and confirm-first. It never asks for a seed phrase or private key, never signs or broadcasts, and the registry contracts do not hold user assets or make arbitrary external calls. Unknown selectors and unavailable critical evidence fail closed.”

Then say the honest limitation explicitly: “An external EOA can still sign elsewhere. This MVP protects the approval flow it is integrated into. Universal enforcement requires a programmable account, wallet adapter, or smart-account module, which is a next-step integration rather than a claim we make today.”

This slide is designed to earn trust with security judges. Do not rush the limitation. A candid boundary is stronger than an inflated claim.

**Transition:** “Now we can show the product as a judge would experience it—in under ninety seconds.”

## Slide 7 — 3:25–4:25

**Say before the live interaction:** “I will run the same three scenarios every time: an exact approval, an unlimited approval, and an undecodable request or permit. There is no wallet connection, no gas, and no real funds.”

**At the mismatch:** “The user said claim only. The decoder found `approve(spender, uint256.max)`. The policy engine returns `MISMATCH — DO NOT APPROVE / EXECUTE` and cites `IG-APPROVE-001`.”

**At the match:** “Now the exact amount and approved spender agree with the policy. This is `MATCH — constraints satisfied; safe to review`; the product is not trying to block every action.”

**At the uncertainty:** “Here the selector or nested evidence is unavailable. We show `CANNOT VERIFY` instead of pretending the request is safe.”

The live section should not become a code tour. Keep the cursor still during the verdict and use the side-by-side effect as the story. If the live RPC is slow, narrate the evidence state and wait. If an RPC fails, disclose it and use the public fixture path without claiming live chain evidence.

## Slide 8 — 4:25–4:55

**Say:** “Every decision becomes a versioned evidence receipt. The receipt records intent, request, and evidence hashes, the engine and decoder versions, evaluator identity, expiry, and revocation state. The policy registry stores user-owned policy commitments. The receipt registry verifies an EIP-712 evaluator signature and anchors the proof on Base Sepolia.”

Make the limitation clear: “This is not a safety oracle. It proves what was checked and which evaluator signed that result.” The contracts are deliberately small and non-custodial. This is the answer to the judge who asks why blockchain belongs in an off-chain analysis product.

**Transition:** “That makes the system reusable beyond this one demo.”

## Slide 9 — 4:55–5:25

**Say:** “The integration surfaces are Orion agents, launchpads, wallets, and Base dApps. An agent can ask a user for confirmation and attach a policy and receipt. A launchpad can make unfamiliar protocol actions easier to review. A wallet or dApp can turn opaque prompts into explicit intent checks.”

Use the central phrase: “Before value moves, prove the action matches intent.” The economic story is API or integration revenue from products that need safer autonomous actions. Do not promise a token or claim that the product replaces existing security stacks. The strongest wedge is an interoperable policy-and-receipt layer that can incorporate other evidence providers.

## Slide 10 — 5:25–5:55

**Say:** “The judging case is direct. Usefulness: we address a costly, understandable signing mistake. Execution: the demo works without a wallet, the decoder and policy engine are typed, the receipts and contracts are tested, and the repository is reproducible. Originality: we verify intent fidelity rather than publishing another opaque safe label. Security: we are read-only, non-custodial, fail closed, and honest about limits.”

Then make the ask: “Integrate IntentGuard anywhere an autonomous agent asks a human to approve value movement.” This is the moment to look at the judges rather than the screen.

**If asked why this should win:** “Because the product is useful in one glance, credible under inspection, and memorable because it refuses to guess.”

## Slide 11 — 5:55–6:10

**Say:** “Autonomous finance earns trust by proving what it means. IntentGuard is the transaction-intent firewall for autonomous finance: a live demo, an open-source engine, Base-verifiable receipts, and an Orion-ready integration surface.”

Stop after the final sentence. Do not add a second closing explanation. Leave the deck on screen during questions with the live demo URL and repository ready in another window.

## Q&A handoff

After the close, say: “I’m happy to go deeper on the policy engine, EIP-712 permits, contract security, evaluator trust, or the path from confirm-first analysis to smart-account enforcement.” This gives the judges a menu that aligns with the prepared defense playbook.

## Presenter recovery cues

| Situation | Recovery line |
|---|---|
| Judge asks if this is just a simulator | “Simulation is evidence. Our wedge is comparing that evidence to an explicit user policy.” |
| Judge asks if the EOA is universally blocked | “Not in this MVP. We protect the integrated flow; universal enforcement needs a programmable account.” |
| Live RPC stalls | “The system is waiting for critical evidence; it will not turn that absence into a pass.” |
| Judge asks where AI is | “AI normalizes and explains. Deterministic code decides.” |
| Judge asks about unsupported routers | “Unsupported nested effects return `CANNOT_VERIFY`; we do not claim a pass without decoding.” |
| Judge asks for business model | “API and integration revenue from agents, launchpads, wallets, and Base dApps.” |

## References

[1]: https://orionagents.org/hackathon "Orion Builder Hackathon — official rules and judging"

[2]: https://orionagents.org/docs "Orion Agents Documentation — vetting and risk management"

[3]: https://eips.ethereum.org/EIPS/eip-712 "EIP-712: Typed Structured Data Hashing and Signing"

[4]: https://eips.ethereum.org/EIPS/eip-2612 "ERC-2612: Permit Extension for EIP-20 Signed Approvals"
