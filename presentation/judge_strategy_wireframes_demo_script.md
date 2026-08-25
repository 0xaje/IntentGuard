# IntentGuard Hackathon Presentation Package
## Judge Evaluation Strategy, Frontend Wireframes, and Live Demo Script

**Entry:** IntentGuard  
**Positioning:** The transaction-intent firewall for autonomous finance  
**Target audience:** Orion partner judges, builders, Base ecosystem operators, launchpad and exchange partners, and security-conscious users

## 1. Presentation objective

The presentation must cause a judge to understand the product in three seconds, trust the implementation in thirty seconds, and remember the core contrast after the demo: **what the human thinks they are approving versus what the chain will actually authorize**.

The pitch should not frame IntentGuard as a generic security scanner. Established products already simulate and assess transactions. IntentGuard’s differentiated claim is narrower and more defensible: **it compares a user-declared intent and hard limits to a decoded transaction or typed-data signature and fails closed when the effect cannot be verified**.

The presentation has four proof obligations:

| Proof obligation | Evidence the judge should see |
|---|---|
| **The problem is urgent** | A single approval or permit can authorize a much broader action than the user believes. |
| **The agent is real** | It decides which evidence to gather, streams an investigator trace, and explains a deterministic verdict. |
| **The implementation is credible** | Calldata/EIP-712 decoding, policy reason codes, receipts, tests, and non-custodial smart contracts. |
| **The product belongs in Orion** | Reusable trust infrastructure for Orion agents, launchpads, Base dApps, and wallet confirmation flows. |

## 2. Judge scorecard strategy

The official hackathon emphasizes **usefulness, execution, and originality**, with vetting and community signals influencing the final outcome. IntentGuard should make each criterion explicit instead of hoping the judge infers it.

| Criterion | What the judge is asking | IntentGuard answer | Slide/demo proof |
|---|---|---|---|
| **Usefulness** | Does this solve a painful, high-value problem? | It prevents users from signing permissions they did not intend to grant. | Side-by-side intent/effect mismatch. |
| **Execution** | Is it built, reliable, and easy to try? | A read-only demo works without a wallet and returns a decision quickly. | Exact approval, unlimited approval, and permit fixtures. |
| **Originality** | Is this more than a chatbot or dashboard? | It verifies intent fidelity, not only contract reputation or transaction danger. | Three-state verdict and policy rule trace. |
| **Security** | Can I trust the system with user funds? | It never touches private keys, custody, signing, or arbitrary execution. | Trust-boundary slide and repository tests. |
| **Economic viability** | Who would integrate or pay for it? | Wallets, launchpads, exchanges, and autonomous agents need a pre-signing trust layer. | Integration wedge and store strategy. |
| **Strategy clarity** | Are rules and limitations explicit? | Published deterministic rules, versioned receipts, and fail-closed uncertainty. | Architecture and evidence receipt slides. |

### 2.1 Judge-specific emphasis

| Judge perspective | Lead with | Avoid |
|---|---|---|
| Launchpad or ecosystem partner | Trust increases conversion and reduces support/security incidents at the point of user action. | “AI safety” without a concrete flow. |
| Exchange or trading partner | Policy caps, spend limits, permit visibility, and reviewable receipts. | Claiming that the product replaces exchange security infrastructure. |
| Agent-economy partner | Every autonomous agent can prove that its proposed action matches the user’s authorization. | Presenting the system as a one-off wallet utility. |
| Security-minded judge | Deterministic authority, fail-closed behavior, public limitations, and no custody. | A single opaque risk score. |
| Builder judge | Clean interfaces, tests, versioned evidence, and an obvious expansion path. | A polished frontend with no reproducible implementation proof. |

## 3. The three-line narrative

The entire presentation should be compressible to three lines:

> **Problem:** Wallet prompts describe requests, not intent. A user can think “claim” while authorizing “unlimited spend.”
>
> **Product:** IntentGuard turns plain-language intent into hard limits, decodes the proposed transaction or permit, and compares intent to effect.
>
> **Proof:** The agent produces a deterministic `MATCH`, `MISMATCH`, or `CANNOT_VERIFY` verdict with evidence, then anchors a tamper-evident receipt on Base.

## 4. Frontend information architecture

The demo UI should be a single-screen workflow with progressive disclosure. Judges should never need to navigate a dashboard before seeing the product’s core decision.

| Region | Purpose | Required content |
|---|---|---|
| Header | Establish product and trust boundary. | IntentGuard wordmark, `BASE`, `READ-ONLY ANALYSIS`, and a no-wallet status. |
| Intent composer | Capture the human’s goal. | Natural-language field, editable extracted constraints, and policy toggles. |
| Request input | Capture what the wallet or dApp asks for. | Scenario selector, raw calldata or typed-data toggle, and payload area. |
| Analyze action | Start the agent. | Primary button: `CHECK INTENT`. Secondary action: `Load safe example`. |
| Investigator trace | Make agent behavior visible. | Normalizing, decoding, reading Base evidence, policy comparison, receipt creation. |
| Verdict panel | Deliver the memorable moment. | Large state, concise explanation, primary reason code, and action guidance. |
| Evidence drawer | Support judge scrutiny. | Decoded fields, rule outcomes, block reference, hashes, and receipt verification. |

## 5. Wireframe A — landing and analysis state

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ INTENTGUARD     TRANSACTION-INTENT FIREWALL          BASE  |  READ-ONLY       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Tell us what you mean to do                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Claim an airdrop. Do not grant any token spending permission.           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  Extracted policy:  ACTION CLAIM   |   APPROVAL EXACT_ONLY   |   NATIVE NO   │
│                                                                              │
│  What is the wallet asking you to approve?                                  │
│  ┌─────────────────────────────────────────┐ ┌────────────────────────────┐ │
│  │ Scenario:  Claim / approval mismatch ▾  │ │ [ Paste calldata ] [Permit] │ │
│  │                                         │ │                              │ │
│  │ 0x095ea7b3...                           │ │                              │ │
│  │                                         │ │                              │ │
│  └─────────────────────────────────────────┘ └────────────────────────────┘ │
│                                                                              │
│                [ CHECK INTENT ]       [ Load safe example ]                 │
│                                                                              │
│  Agent trace                                                               │
│  ○ Intent normalized     ○ Request decoded     ○ Base evidence read         │
│  ○ Policy comparison    ○ Receipt prepared                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Wireframe A behavior

The input should accept a plain-language statement and reveal the extracted hard constraints below it. The extracted constraints are editable; the model is not allowed to silently invent an address, token, amount, chain, or policy. The scenario selector is a convenience for the public demo, not a hidden mock path: each fixture must call the same decoder and policy engine used for pasted payloads.

## 6. Wireframe B — mismatch verdict

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RESULT                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  MISMATCH  ·  DO NOT SIGN                                             │  │
│  │  The request does not match your stated intent.                       │  │
│  │                                                                        │  │
│  │  Primary rule: IG-APPROVE-001                                         │  │
│  │  Unlimited allowance detected; exact approval required.                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  HUMAN INTENT                         ON-CHAIN EFFECT                         │
│  ┌──────────────────────────────┐     ┌──────────────────────────────────┐  │
│  │ Claim a free token            │     │ approve(spender, uint256.max)   │  │
│  │ No token permissions          │  ≠  │ USDC allowance: unlimited        │  │
│  │ Chain: Base                   │     │ Spender: 0x7A...91               │  │
│  └──────────────────────────────┘     └──────────────────────────────────┘  │
│                                                                              │
│  Evidence:  4 PASS   1 FAIL   0 UNAVAILABLE                                 │
│  [ View policy rules ]   [ Download receipt ]   [ Run another check ]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

The mismatch panel must use plain language before technical detail. The technical rule code is shown for reproducibility, but the first sentence should be understandable to a non-security judge. The state should be visually unmistakable without relying on color alone: use a red state label, a warning icon shape, and the words `DO NOT SIGN`.

## 7. Wireframe C — cannot-verify state

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  CANNOT VERIFY  ·  DO NOT SIGN YET                                           │
│  The request contains an unknown selector or incomplete route evidence.       │
│                                                                              │
│  What we know                                                               │
│  ✓ Chain ID matches Base                                                     │
│  ✓ Request contains calldata                                                 │
│                                                                              │
│  What we cannot prove                                                       │
│  ! The nested call could not be decoded with a verified ABI.                 │
│                                                                              │
│  This is a deliberate fail-closed result. IntentGuard will not guess.        │
│  [ Show raw selector ]   [ Try a verified fixture ]   [ Download receipt ]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

The amber state is important to the pitch. It shows that the system is not a binary confidence toy: uncertainty is surfaced as a user-protective outcome.

## 8. Wireframe D — evidence drawer and receipt

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ EVIDENCE TRACE                                                               │
├──────────────────┬───────────────────────────────────────────────────────────┤
│ PASS  Chain ID    │ Request chain: 84532  |  Intent chain: 84532             │
│ PASS  Decode      │ ERC-20 approve(address,uint256)                          │
│ PASS  Token       │ USDC  | 0x...                                            │
│ FAIL  Policy      │ amount == uint256.max  |  exact approval required        │
│ PASS  Version     │ engine 1.0.0  |  decoder 1.0.0                          │
├──────────────────┴───────────────────────────────────────────────────────────┤
│ RECEIPT                                                                      │
│ intentHash 0xabc...   requestHash 0xdef...   evidenceHash 0x123...             │
│ [ Verify on Base Sepolia ]                                  [ Download JSON ] │
└──────────────────────────────────────────────────────────────────────────────┘
```

The drawer exists to answer “how do I know?” without overwhelming the first screen. The receipt should show the exact hashes, evaluator version, verdict, expiry, and limitation statement. Raw user text should not be placed in public URLs or on-chain storage.

## 9. Demo script: 90 seconds

### 0–8 seconds: open with the problem

**Screen:** Landing state with a wallet-style approval request.  
**Spoken line:** “The most expensive crypto mistake can be one signature you did not understand. Wallets show the request; they do not know what you intended.”

### 8–20 seconds: state the intent

**Action:** Enter: `Claim an airdrop. Do not grant any token spending permission.`  
**Spoken line:** “IntentGuard starts with the human’s goal. It converts that goal into explicit policy: claim only, exact approvals, no native value, and fail closed when the request is unclear.”

### 20–40 seconds: expose the mismatch

**Action:** Choose the public deceptive approval fixture. Click `CHECK INTENT`. Let the trace stream through normalization, decode, evidence, and policy comparison.  
**Spoken line:** “The agent decodes what the wallet is asking for. This is not a claim. It is `approve(spender, uint256.max)`: unlimited permission to move USDC.”

### 40–52 seconds: land the memorable verdict

**Action:** Show the red mismatch panel and side-by-side human intent versus chain effect.  
**Spoken line:** “IntentGuard returns `MISMATCH — DO NOT SIGN`, cites rule `IG-APPROVE-001`, and shows the exact field that violated the user’s policy.”

### 52–66 seconds: prove it does not block everything

**Action:** Load the exact-amount approval or safe fixture.  
**Spoken line:** “Legitimate actions still pass. When the amount, token, spender, and chain match, the result is `MATCH — safe to review`. The engine decides; the model only explains.”

### 66–78 seconds: show typed-data permits

**Action:** Load the EIP-2612 permit fixture.  
**Spoken line:** “It also reads typed-data permits. A signature that looks like ‘sign message’ can still grant a large allowance, so IntentGuard checks owner, spender, value, deadline, nonce, domain, and chain.”

### 78–86 seconds: show uncertainty and receipt

**Action:** Load unknown-selector fixture, then open evidence drawer or receipt.  
**Spoken line:** “When the evidence is incomplete, it does not guess. `CANNOT VERIFY` is a protective result. Every decision can be exported as a versioned evidence receipt.”

### 86–90 seconds: close on Orion fit

**Action:** Show Base receipt anchor and repository/test panel.  
**Spoken line:** “IntentGuard is the confirm-first trust layer for Orion agents: read-only, non-custodial, deterministic, and ready to integrate wherever autonomous value is about to move.”

## 10. Presenter choreography

The presenter should keep the cursor still during verdict moments, avoid reading the trace line by line, and use the same three fixtures every time. The live browser should be opened in a clean window with no wallet connection. A local fallback is permitted only if the exact same code path is served from the public deployment or a recorded evidence artifact; the presenter must never claim live chain verification if the demo is offline.

| Rehearsal checkpoint | Pass condition |
|---|---|
| Cold start | The demo URL opens without login or wallet connection. |
| Input | The presenter can enter the intent and load a fixture without developer tools. |
| Timing | The first mismatch verdict appears by 40 seconds. |
| Explainability | A judge can identify the exact violated field in one glance. |
| Safety | No seed phrase, private key, transaction confirmation, or real funds appear. |
| Recovery | If a live RPC call fails, the UI shows `CANNOT_VERIFY` or the presenter clearly discloses the interruption. |
| Close | The final frame contains the product, repository, architecture, and integration message. |

## 11. Objection handling

**“Isn’t this just Blockaid?”** IntentGuard should answer: “Transaction simulation and security scanning are valuable primitives. Our wedge is intent fidelity: the user sets a goal and hard limits first, then we verify whether the request matches those constraints. We are building an agent-native policy and evidence layer that can sit in front of those primitives.”

**“Can it stop a user from signing?”** Answer: “The MVP is read-only and confirm-first. It warns and blocks the product flow, but an external EOA can always sign elsewhere. Universal enforcement requires a programmable account or wallet integration, which is a deliberate next step—not a claim we make today.”

**“What happens when the model is wrong?”** Answer: “The model is not the authority. The decoder and policy engine produce the verdict from typed fields and evidence. The model can only generate a constrained explanation from that deterministic result.”

**“Why put anything on-chain?”** Answer: “The on-chain registries do not hold funds and do not execute calls. They anchor hashes, policy versions, evaluator identity, expiry, and revocation so a receipt can be independently verified.”

## 12. Closing message

End with a sentence that is both memorable and technically honest:

> **“Autonomous finance cannot earn trust by asking users to click faster. It earns trust by proving that the action matches what the user meant.”**

### References

[1]: https://orionagents.org/hackathon "Orion Builder Hackathon — official rules, judging, timeline, and live gallery"

[2]: https://orionagents.org/docs "Orion Agents Documentation — vetting, risk commitments, reputation, and builder guidance"

[3]: https://orionagents.org/submit "Orion Agents submission form"

[4]: https://eips.ethereum.org/EIPS/eip-2612 "ERC-2612: Permit Extension for EIP-20 Signed Approvals"

[5]: https://blockaid.io/transaction-security "Blockaid — Transaction Security"

[6]: https://www.chainalysis.com/blog/crypto-drainers/ "Chainalysis — Understanding Crypto Drainers"
