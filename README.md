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

Where did this evidence come from? Rather than presenting opaque analytical ratings, IntentGuard provides a strict, reproducible provenance tree:

```text
Evidence
├── Source: Base JSON-RPC
├── Block: 12345678 (anchored)
├── Transaction: 0x...
├── Receipt: mined_success (confirmed)
├── Contract: 0x...
├── Decoder: Uniswap V3 exactInputSingle / ERC-20 Transfer
├── Decoder version: 1
├── Engine version: 1
└── Evidence hash: 0x...
```

---

## Formal Trust Architecture & Boundaries

```text
                    HUMAN
                      │
                      │ declares intent
                      ▼
             ┌──────────────────┐
             │   INTENT SPEC    │
             │                  │
             │ constraints      │
             └────────┬─────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ POLICY COMMITMENT│
             │                  │
             │ keccak256        │
             └────────┬─────────┘
                      │
                      │
        ┌─────────────▼─────────────┐
        │       INTENTGUARD         │
        │                           │
        │ deterministic verifier    │
        │                           │
        │ NO LLM VERDICT            │
        │ NO CUSTODY                │
        │ NO PRIVATE KEYS CLIENT    │
        └─────────────┬─────────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ REAL TX EVIDENCE │
             └────────┬─────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
        MATCH      MISMATCH   CANNOT_VERIFY
          │           │           │
          └───────────┼───────────┘
                      ▼
               EIP-712 RECEIPT
                      │
                      ▼
              RECEIPT REGISTRY
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
