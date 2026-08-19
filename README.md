# IntentGuard

IntentGuard is a deterministic intent-verification and attestation layer for AI agent transactions on Base. It compares human-declared constraints with observable transaction behavior and produces a cryptographically verifiable verdict before or after execution, depending on available evidence.

The platform does not connect a wallet, request seed phrases or private keys, move funds, sign transactions on behalf of users, or fabricate blockchain evidence.

---

## The Two Distinct Security Stages

IntentGuard explicitly distinguishes between two different security problems in autonomous AI agent transactions:

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                INTENTGUARD STAGES                                 │
├─────────────────────────────────────────┬─────────────────────────────────────────┤
│             PRE-EXECUTION               │             POST-EXECUTION              │
│ "Can this proposed transaction safely   │ "Did the transaction that actually      │
│  proceed according to declared intent?" │  executed remain consistent with intent?"│
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ • Validates calldata against allowlist  │ • Inspects mined Base Mainnet receipts  │
│ • Simulates quotes (Uniswap QuoterV2)   │ • Decodes emitted ERC-20 Transfer logs  │
│ • Checks recipient & allowance bounds   │ • Measures actual executed slippage     │
│ • Preflight deterministic policy pass   │ • EIP-712 Attestation anchored on Base  │
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Honest Security Boundary**: Pre-execution and post-execution are different security problems. The current implementation is strongest at **post-execution / transaction evidence verification** (alongside read-only preflight quote inspection). IntentGuard does not pretend to have complete pre-execution custody protection (such as state-changing mempool interception or private enclave execution), but instead provides a verifiable attestation layer that integrates into agent guardrails and audit pipelines.

---

## The Zero-LLM Verdict Engine Guarantee

> [!IMPORTANT]
> **"The model may help interpret intent. It does not decide whether the transaction is safe."**

IntentGuard strictly separates natural language interpretation from safety evaluation:

```text
Natural Language
      ↓
Parser / LLM
      ↓
Structured IntentSpec
      ↓
Schema validation (Zod)
      ↓
Canonical policy (keccak256 commitment)
      ↓
DETERMINISTIC ENGINE (Pure TypeScript / Solidity)
      ↓
VERDICT (MATCH / MISMATCH / CANNOT_VERIFY)
```

1. **LLM Authority Boundary**: If an LLM is used to parse natural language constraints into an `IntentSpec`, its role ends at structured schema extraction.
2. **Deterministic Evaluation Authority**: The final safety verdict (`MATCH`, `MISMATCH`, `CANNOT_VERIFY`) is computed **100% deterministically** by pure arithmetic and exact on-chain log comparisons. No LLM has verdict authority.

---

## Critical Technical Distinction

IntentGuard explicitly distinguishes between three concepts often conflated in Web3 transaction security:

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                               TECHNICAL DISTINCTIONS                              │
├─────────────────────────┬─────────────────────────┬───────────────────────────────┤
│  TRANSACTION EVIDENCE   │      CURRENT QUOTE      │     HISTORICAL SIMULATION     │
├─────────────────────────┼─────────────────────────┼───────────────────────────────┤
│ • Observable on-chain   │ • Read-only `eth_call`  │ • Re-executing transaction    │
│   facts from mined block│   to Uniswap QuoterV2   │   at past historical block    │
│ • Real logs & transfers │ • Latest block estimate │ • Archive debug_trace re-run  │
│ • Status & real gas     │ • Point-in-time pricing │ • NOT claimed by IntentGuard  │
│ • Authoritative evidence│ • Non-binding estimate  │ • (Requires heavy tracing node│
└─────────────────────────┴─────────────────────────┴───────────────────────────────┘
```

> [!NOTE]
> `inspectBaseTransaction` performs **real-time Base RPC inspection, calldata decoding, receipt inspection, event analysis, and supported read-only quote evidence**. It provides observable evidence and current market quotes—it does NOT claim archive-state historical re-execution simulation.

---

## Key Capabilities

| Capability | Stage | Behavior & Safety Guarantee |
|---|---|---|
| **Base Mainnet Inspection** | Post-Execution | Reads live transaction, mined receipt, event logs, and state deltas directly via server-side Base JSON-RPC. |
| **Supported Transaction Decoding** | Pre & Post | Decodes **ERC-20 approvals and supported permit evidence** (`approve`, `transfer`, `transferFrom`, ERC-2612 typed `Permit`), and allowlisted Uniswap V3 `SwapRouter02.exactInputSingle` routes. |
| **Evidence Provenance & Block Anchoring** | Forensic | Anchors every verified fact to an immutable Base block number/hash, transaction hash, destination contract, decoder version, and cryptographic evidence hash. |
| **Evidence Enrichment** | Pre & Post | Resolves router-path ERC-20 symbol/decimals through read-only calls and queries read-only QuoterV2 estimates where applicable. |
| **Deterministic Verdicts** | Pre & Post | Strict policy checks producing `MATCH`, `MISMATCH`, or `UNVERIFIABLE`. Missing evidence fails closed. |
| **Cryptographic Trust Loop** | Attestation | Computes canonical intent, request, and evidence hashes, and anchors EIP-712 evaluator-signed receipts to Base Sepolia contracts. |
| **Interactive Forensic Signal UI** | Both | Modern dashboard showing transaction signals, policy checks, raw evidence payloads, provenance tree, and review boundaries. |
| **Human Review Boundary** | Operational | Gated non-signing review acknowledgement enabled only for verified `MATCH` results. |

> [!TIP]
> **Permit Scope Note**: The current core engine explicitly decodes **ERC-20 approvals and standard ERC-2612 permit typed data**. Universal Uniswap Permit2 (`PermitSingle`/`PermitBatch`) is not advertised as completed in this core package and is scheduled as a dedicated standalone decoder module.

---

## Evidence Provenance & Forensic Origin

Where did this evidence come from? Rather than presenting opaque analytical ratings, IntentGuard provides a strict, reproducible provenance tree with first-class version anchoring:

```text
Evidence
├── Source: Base JSON-RPC
├── Chain ID: 8453 (Base Mainnet)
├── Block: 12345678 (anchored)
├── Transaction: 0x...
├── Receipt: mined_success (confirmed)
├── Contract: 0x...
├── Decoder: Uniswap V3 exactInputSingle / ERC-20 Transfer
├── Protocol version: 1
├── Policy version: 1
├── Engine version: 1
├── Decoder version: 1
├── Receipt schema version: 1 (EIP-712)
└── Evidence hash: 0x...
```

> **Why explicit versioning matters**: When a decoder or rule is updated in the future, past on-chain receipts remain unambiguous. A judge or verifier can always attest: *"This receipt was deterministically evaluated under decoder v1 and engine v1."*

## Technical Specification & Source of Truth

| Parameter | Canonical Value | Notes |
|---|---|---|
| **Product Version** | `IntentGuard v0.2.0` | Deterministic Intent Fidelity & Attestation Layer |
| **Verification Network** | **Base Mainnet** (`8453`) | Live Base JSON-RPC Evidence, Decoding, QuoterV2 |
| **Attestation Network** | **Base Sepolia** (`84532`) | EIP-712 Registry Anchoring & Revocation |
| **Solidity Version** | `0.8.24` | OpenZeppelin v5.0.2 + EIP-712 Typed Data |
| **Automated Tests** | **33 Passing** across 3 suites | 17 Vitest unit/integration, 9 Hardhat (gas tracked), 7 TSX engine |
| **Policy Registry** | `0x45DF2847c1f8d8b67195861F1a2a4bE13f48a924` | Policy commitments & versioning |
| **Receipt Registry** | `0x6f31A8B28a6f95886dF02B487c6fBEB5F95C48A1` | EIP-712 signature verification & receipts |
| **Target Registry** | `0x19f2a7a40C3B7f8A2aE72d8a57A250fD2A20B71b` | Allowlisted contract addresses & selectors |

---

## Formal Trust Architecture & Agent Boundaries

```text
                         HUMAN
                           │
                           │ Intent
                           ▼
                  ┌─────────────────┐
                  │ Intent Compiler │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Policy Registry │
                  │   Commitment    │
                  └────────┬────────┘
                           │
                           │ Policy
                           ▼
                       AI AGENT
                           │
                           │ Proposed Request
                           ▼
                  ┌─────────────────┐
                  │   IntentGuard   │
                  │                 │
                  │ Decoder         │
                  │ Evidence        │
                  │ Policy Engine   │
                  └────────┬────────┘
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
              MATCH              MISMATCH
                 │                   │
                 ▼                   ▼
          Human approval         BLOCK/STOP
                 │
                 ▼
             Execution
                 │
                 ▼
             Base RPC
                 │
                 ▼
          Post-execution
             evidence
                 │
                 ▼
          EIP-712 Receipt
                 │
                 ▼
          Receipt Registry
```

> [!IMPORTANT]
> ### The Orion Integration Story: Cryptographic Intent Fidelity for Autonomous Agents
> **IntentGuard gives Orion agents a cryptographic *“did this action actually match the user’s intent?”* layer.**
>
> ```text
>              ORION AGENT
>                   │
>                   │ proposes candidate action (calldata / tx)
>                   ▼
>           ┌─────────────────┐
>           │   INTENTGUARD   │
>           │                 │
>           │ Intent Fidelity │
>           │ Deterministic   │
>           │ Evidence        │
>           │ Attestation     │
>           └────────┬────────┘
>                    │
>              MATCH / BLOCK
>                    │
>                    ▼
>              HUMAN APPROVAL
>
> Then:
>
> IntentGuard Receipt
>         ↓
> On-chain proof (Base Sepolia)
>         ↓
> Agent reputation / audit trail
> ```
>
> 1. **Zero-Custody Agent Operation**: The Orion agent plans multi-step DeFi routes and emits a candidate proposal (`ProposedRequest`). It never touches user private keys.
> 2. **Independent Policy Verification**: IntentGuard deterministically evaluates the candidate action against the human policy commitment.
> 3. **Tamper-Evident Reputation**: Each anchored EIP-712 receipt attributes the execution outcome to the `agentId`, creating an immutable on-chain track record of agent fidelity.

### The Core Evaluation Triad

IntentGuard evaluates three distinct, decoupled inputs to compute an immutable verdict:

```text
       IntentSpec (Human Constraints & Caps)
                        +
ProposedRequest (Agent Target, Calldata, Value, Nonce)
                        +
    ObservableEvidence (Base RPC, Receipts, Logs)
                        ↓
                VerificationResult
```

#### **Formal `ProposedRequest` Schema**
```typescript
type ProposedRequest = {
  chainId: number;             // e.g. 8453 (Base Mainnet)
  from?: Address;              // Transaction subject (EOA or Smart Account)
  to?: Address;                // Destination contract or recipient
  value?: string;              // Native value in wei
  data?: Hex;                  // Encoded calldata
  nonce?: number | string;     // Anti-replay / state nonce
  transactionHash?: Hex;       // Mined / broadcast transaction identifier
  agentId?: string;            // Proposing Orion / AI agent ID
  agentVersion?: string;       // Agent model / prompt template version
};
```

### Formal `VerificationReceipt` Cryptographic Schema

The receipt cryptographically binds the entire verification lifecycle into an immutable, EIP-712 typed data structure:

```text
VerificationReceipt
├── [Policy Commitment]
│   ├── policyId            ──► keccak256(owner, committer, nonce, intentHash, version)
│   ├── intentHash          ──► Canonical keccak256(IntentSpec)
│   └── policyVersion       ──► Strict version identifier
│
├── [Execution Binding]
│   ├── transactionHash     ──► Proposed calldata hash or mined Base tx hash
│   ├── transactionSubject  ──► Execution address / Smart account on Base
│   └── chainId             ──► 8453 (Base Mainnet) / 84532 (Base Sepolia)
│
├── [Evidence Hashes]
│   ├── requestHash         ──► Canonical keccak256(ProposedRequest)
│   └── evidenceHash        ──► Canonical keccak256(EvidenceItems[])
│
├── [Deterministic Decision]
│   └── verdict             ──► MATCH (0), MISMATCH (1), CANNOT_VERIFY (2)
│
├── [Temporal & Attestation Bounds]
│   ├── evaluator           ──► Address holding EVALUATOR_ROLE on ReceiptRegistry
│   ├── evaluatedAt         ──► Timestamp of evaluation
│   └── expiresAt           ──► Timestamp when attestation ceases to be active
│
└── [Code Provenance & Replay Defense]
    ├── engineVersion       ──► Deterministic policy engine version
    ├── decoderVersion      ──► Supported calldata decoder version
    └── receiptId           ──► Unique 32-byte cryptographic identifier
```

---

### Strict Security Invariant: Subject Separation

IntentGuard enforces a fundamental security property across the entire trust loop:

$$\mathbf{policyOwner} \neq \mathbf{transactionSubject} \neq \mathbf{evaluator}$$

```text
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│       POLICY OWNER      │     │   TRANSACTION SUBJECT   │     │   ATTESTING EVALUATOR   │
├─────────────────────────┤     ├─────────────────────────┤     ├─────────────────────────┤
│ • Human user or DAO     │  ≠  │ • Autonomous AI Agent   │  ≠  │ • Independent Attestor  │
│ • Declares IntentSpec   │     │   (Orion / Smart Acct)  │     │ • Holds EVALUATOR_ROLE  │
│ • Commits policy hash   │     │ • Proposes/Executes tx  │     │ • Signs EIP-712 receipt │
│ • Holds no custody      │     │ • Cannot attest itself  │     │ • Holds no user funds   │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

> **Why this matters**: In naive agent frameworks, the agent is either assumed to be the policy owner (meaning it can re-define its own rules) or the evaluator (meaning it can rubber-stamp its own actions). IntentGuard mathematically isolates all three entities. While they may technically be the same address in single-user testing, **the protocol never assumes identity correlation**.

### Deterministic Confidence Semantics

IntentGuard strictly rejects probabilistic "AI confidence scores". Instead, it applies discrete, deterministic evidence evaluation:

| Evidence State | Meaning | Effect on Final Verdict |
|---|---|---|
| **`VERIFIED`** | Observable on-chain / calldata evidence satisfies the human constraint. | Permits `MATCH` if all required checks are satisfied. |
| **`CONFLICTING`** | Observable evidence directly contradicts an explicit constraint limit. | Triggers deterministic **`MISMATCH`**. |
| **`INSUFFICIENT`** | Required facts are unmined, missing from RPC, or unresolvable from calldata. | Triggers fail-closed **`CANNOT_VERIFY`** (unless a conflicting check is present). |

**Example Evaluation:**
```text
Network       VERIFIED
Recipient     VERIFIED
Spend limit   VERIFIED
Slippage      INSUFFICIENT
Approval      CONFLICTING
─────────────────────────────
VERDICT   →   MISMATCH
```

### Explicit Trust Invariants

IntentGuard operates under strict non-custodial, deterministic boundaries. **IntentGuard does NOT:**
1. **Hold user funds**: Zero token custody, no escrow contracts, and no balance management.
2. **Hold user private keys**: Never receives, stores, or requests mnemonic phrases or private keys.
3. **Execute transactions on behalf of users**: Never broadcasts on behalf of EOAs or acts as a relayer.
4. **Trust an LLM to determine the final verdict**: LLMs only normalize natural language into typed schemas; all verdicts (`MATCH`, `MISMATCH`, `UNVERIFIABLE`) are computed by pure, deterministic TypeScript/Solidity policy code.
5. **Infer missing blockchain evidence**: Missing RPC data or unmined states never default to success.
6. **Convert unavailable evidence into approval**: Unknown selectors, unsupported routes, or unavailable RPC endpoints fail closed.

The EIP-712 Receipt Type Hash:
```text
0x018c9f3900967057c49face3f3c0b093f4f06eddaac8c90913abaaa53e4d6dfe
```

---

## Modular Protocol Architecture

The codebase is organized into decoupled, single-responsibility layers:

```text
intentguard/
│
├── client/              # React + Vite Forensic Signal UI
│   ├── src/pages/       # Workspace & Verification consoles
│   └── src/components/  # SignalMark, Origin trees, and Badges
│
├── server/              # Fast, non-custodial backend gateway
│   ├── routers/         # tRPC API endpoints (intent, policy, receipts)
│   ├── rpc/             # Real-time Base Mainnet JSON-RPC & QuoterV2 client
│   ├── attestation/     # EIP-712 hashing & cryptographic signatures
│   └── security/        # Non-custodial invariants & input sanitization
│
├── engine/              # Pure, deterministic TypeScript verification engine
│   ├── decoder/         # Calldata parsing (Uniswap V3, ERC-20, Permits)
│   ├── policy/          # Rule evaluation & fail-closed logic
│   ├── evidence/        # Evidence models & discrete state definitions
│   ├── canonical/       # Deterministic JSON canonicalization & keccak256
│   └── receipt/         # Canonical receipt construction & verification
│
├── contracts/           # Smart contracts on Base Sepolia
│   ├── interfaces/      # IIntentGuardTypes & registry interfaces
│   ├── IntentGuardPolicyRegistry.sol
│   ├── IntentGuardReceiptRegistry.sol
│   └── IntentGuardTargetRegistry.sol
│
├── scripts/             # Hardhat deployment & attestation scripts
├── test/                # Cross-package test suites & fixtures
└── presentation/        # Judge Q&A playbooks, pitch deck, & demo scripts
```

---

## Repository Map

| Path | Contents & Role |
|---|---|
| [`client/`](client/) | React 19 + Vite + Tailwind frontend with Forensic Signal UI and Intent Workspace. |
| [`server/`](server/) | Express server, tRPC routers, Base RPC inspection, crypto verification, and policy evaluator. |
| [`shared/`](shared/) | Shared TypeScript schemas, types, and intent constants across client and server. |
| [`engine/`](engine/) | Core standalone deterministic policy engine, decoders, canonical hasher, and test fixtures. |
| [`contracts/`](contracts/) | Solidity registries: `IntentGuardPolicyRegistry`, `IntentGuardReceiptRegistry`, `IntentGuardTargetRegistry`. |
| [`contracts/test/`](contracts/test/) | Contract unit and integration test suites. |
| [`scripts/`](scripts/) | Hardhat deployment and Base Sepolia verification scripts. |
| [`presentation/`](presentation/) | Pitch deck, judge Q&A playbooks, wireframes, architecture diagrams, and speaker notes. |

---

## Local Development & Validation

### Prerequisites
- **Node.js**: v22+
- **Package manager**: `pnpm` (v9+) or `npm`

### Quickstart

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Run development server** (starts both Express backend and Vite frontend with hot reload):
   ```bash
   pnpm dev
   ```
   Open `http://localhost:3000` to interact with the IntentGuard Workspace.

3. **Run test suites**:
   ```bash
   # Run full test suite
   pnpm test

   # Run smart contract tests
   pnpm run test:contracts

   # Run deterministic engine tests
   pnpm run test:engine
   ```

4. **Typecheck and build**:
   ```bash
   pnpm check
   pnpm build
   ```

---

## Smart Contracts & Base Sepolia Deployment

### Contract Overview
- [`IntentGuardPolicyRegistry.sol`](contracts/IntentGuardPolicyRegistry.sol): User-owned, versioned policy-hash commitments with validity windows and revocation.
- [`IntentGuardReceiptRegistry.sol`](contracts/IntentGuardReceiptRegistry.sol): EIP-712 evaluator-signed evidence receipts bound to chain ID, subject, verdict, and expiry.
- [`IntentGuardTargetRegistry.sol`](contracts/IntentGuardTargetRegistry.sol): Curated target registry for recognized contracts and security status.

### Deployment Sequence
```bash
# Set environment variables in .env (see environment.example.md)
cp .env.example .env

# Deploy registries to Base Sepolia
INTENTGUARD_DEPLOYMENT_OUTPUT=deployments/baseSepolia.json \
pnpm exec hardhat run scripts/deploy.cjs --network baseSepolia

# Verify testnet deployment
INTENTGUARD_DEPLOYMENT_FILE=deployments/baseSepolia.json \
pnpm exec tsx scripts/verify-testnet.ts
```

---

## Judge & Presentation Resources

- [Pitch Deck Source](presentation/intentguard_pitch_deck.md)
- [Architecture & Diagrams](presentation/intentguard_architecture.mmd)
- [Judge Defense & Q&A Playbook](presentation/judge_qa_playbook.md)
- [Speaker Notes & Timing Breakdown](presentation/speaker_notes_timing_breakdown.md)
- [Demo Script & Wireframes](presentation/judge_strategy_wireframes_demo_script.md)

---

## Security & Responsible Use

This project is built for demonstration and hackathon review. It has not been formally audited. For details, refer to [SECURITY.md](SECURITY.md).
