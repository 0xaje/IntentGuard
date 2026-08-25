# IntentGuard

<div align="center">

#### Deterministic Intent Verification & Cryptographic Attestation Layer for Autonomous AI Agents on Base

[![Live Demo](https://img.shields.io/badge/Live%20App-intentguard.onrender.com-success?style=flat-square&logo=render)](https://intentguard-drd7.onrender.com)
[![CI / Test Suite](https://img.shields.io/badge/Tests-42%2F42%20Passing-emerald?style=flat-square)](https://github.com/0xaje/IntentGuard)
[![Base Mainnet](https://img.shields.io/badge/Verification-Base%20Mainnet%20(8453)-blue?style=flat-square)](https://base.org)
[![Base Sepolia](https://img.shields.io/badge/Attestation-Base%20Sepolia%20(84532)-purple?style=flat-square)](https://sepolia.basescan.org)
[![Orion Adapter](https://img.shields.io/badge/Adapter-Orion%20Compatible-orange?style=flat-square)](examples/orion-integration.ts)
[![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

[**Live Application**](https://intentguard-drd7.onrender.com) · [**Pitch Deck**](presentation/intentguard_pitch_deck.md) · [**Judge Q&A Playbook**](presentation/judge_qa_playbook.md) · [**Architecture**](presentation/intentguard_architecture.mmd)

</div>

---

## 1. Executive Summary

**IntentGuard** is an intent-fidelity and cryptographic attestation layer for autonomous AI agents on Base.

It converts human instructions into structured, deterministic constraints and evaluates agent-proposed transactions against observable blockchain evidence.

IntentGuard does not hold user funds, private keys, or custody assets. It does not use an LLM to make the final safety decision.

Instead, the system produces one of three deterministic outcomes:
- **`MATCH`** — All required supported constraints are satisfied by the available evidence. In an integrated agent workflow, `MATCH` permits the action to continue to the execution/confirmation boundary.
- **`MISMATCH`** — Observable transaction behavior conflicts with a declared constraint (**Do Not Approve / Execute**; prevents continuation through integrated middleware).
- **`CANNOT_VERIFY`** — The available evidence is insufficient or unsupported (Fails closed; do not approve).

Successful evaluations can be represented as EIP-712 signed verification receipts and anchored on Base Sepolia (`chainId 84532`), creating an independently verifiable on-chain attestation trail.

### The Architectural Moat: Separation of Interpretation from Enforcement

> **"Agents can decide. IntentGuard verifies."**
> 
> *The agent can be intelligent. The verifier doesn't have to be.*
>
> **LLMs interpret. Deterministic rules enforce.** IntentGuard may use an LLM to translate natural language into a structured `IntentSpec`. The LLM does **not** determine the final verdict. The verdict is computed deterministically from typed policy constraints, decoded transaction data, and observable blockchain evidence.

### Pre-Execution vs. Post-Execution Precision
The same deterministic policy engine can evaluate both unsigned agent proposals before execution and observable transaction evidence after execution. The current public demo proves the verification path with live Base evidence; pre-execution enforcement is exposed through the agent middleware architecture.

---

## 2. IntentGuard Trust & Attestation Architecture

### Product Lifecycle Abstraction
$$\text{\bf Intent} \longrightarrow \text{\bf Evidence} \longrightarrow \text{\bf Verdict} \longrightarrow \text{\bf Attestation}$$

### Complete 7-Stage Implementation Flow
$$\text{\bf Intent} \longrightarrow \text{\bf Policy} \longrightarrow \text{\bf Request} \longrightarrow \text{\bf Evidence} \longrightarrow \text{\bf Verdict} \longrightarrow \text{\bf Receipt} \longrightarrow \text{\bf Proof}$$

```text
                    HUMAN INTENT
                         │
                         ▼
                     IntentSpec
                         │
                 Policy Commitment
                         │
              ┌──────────┴──────────┐
              │                     │
        PRE-EXECUTION         POST-EXECUTION
        Agent proposal        Mined transaction
              │                     │
              └──────────┬──────────┘
                         ▼
                Deterministic Engine
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
           MATCH      MISMATCH   CANNOT_VERIFY
             │
             ▼
        EIP-712 Receipt
             │
             ▼
      Base Sepolia Anchor
```

### 1. Primary Integration Prototype: Orion Agent ([`examples/orion-integration.ts`](examples/orion-integration.ts))

IntentGuard provides a primary Orion-compatible integration prototype illustrating how an agent's proposal is verified prior to execution:

```text
Orion Agent ──► Proposes Transaction ──► IntentGuard.verify(...) ──► [ MATCH / MISMATCH / CANNOT_VERIFY ] ──► Only MATCH continues
```

### 2. Orion Agent Integration ([`examples/orion-integration.ts`](examples/orion-integration.ts))
```typescript
import { verifyAgentAction } from "intentguard";
import { OrionAgent } from "@orion/sdk";

export async function guardOrionPlan(userIntent, orionPlan) {
  const check = verifyAgentAction({
    intent: userIntent,
    request: {
      chainId: 8453, // Base Mainnet
      to: orionPlan.targetAddress,
      data: orionPlan.calldata,
      valueWei: orionPlan.valueWei ?? "0",
      agentId: orionPlan.agentId,
      source: "ORION_AGENT",
    }
  });

  if (!check.isSafe) {
    throw new Error(`[IntentGuard Blocked Orion Action] ${check.primaryReasonCode}: ${check.explanation}`);
  }

  return check.analysis;
}
```

---

## 3. Multi-Framework Adapter Support

In addition to native Orion Agent support, IntentGuard provides drop-in adapters for the broader AI agent ecosystem:

| Framework | Integration File | Description |
|---|---|---|
| **Orion Agent (Primary)** | [`examples/orion-integration.ts`](examples/orion-integration.ts) | Flagship zero-custody planning guardrail and Base Sepolia attestation |
| **Coinbase AgentKit** | [`examples/agentkit-integration.ts`](examples/agentkit-integration.ts) | Action Provider middleware for Base AgentKit runners |
| **ElizaOS Plugin** | [`examples/eliza-integration.ts`](examples/eliza-integration.ts) | Action evaluator plugin for Eliza agent runtimes |
| **Universal 3-Line Middleware** | [`examples/agent-middleware.ts`](examples/agent-middleware.ts) | Generic wrapper for any autonomous agent dispatcher |
| **Developer Terminal CLI** | [`scripts/cli.ts`](scripts/cli.ts) | Terminal & CI/CD audit tool (`npm run audit`) |

---

## 4. Cryptographic Smart Contracts on Base Sepolia

IntentGuard anchors its deterministic verdicts to Solidity registries deployed on **Base Sepolia** (`chainId 84532`):

| Contract | Network | Address | Purpose |
|---|---|---|---|
| **`IntentGuardPolicyRegistry`** | Base Sepolia (`84532`) | `0x45DF2847c1f8d8b67195861F1a2a4bE13f48a924` | User-owned policy commitments & keccak256 intent hashes |
| **`IntentGuardReceiptRegistry`** | Base Sepolia (`84532`) | `0x6f31A8B28a6f95886dF02B487c6fBEB5F95C48A1` | EIP-712 evaluator signature verification & receipt anchoring |
| **`IntentGuardTargetRegistry`** | Base Sepolia (`84532`) | `0x19f2a7a40C3B7f8A2aE72d8a57A250fD2A20B71b` | Curated registry for allowlisted contracts & function selectors |

### Security Invariant: Independent Protocol Roles
Policy ownership, transaction subject, and evaluator identity are represented as separate protocol fields. The evaluator is independently authorized and is never substituted for the transaction subject merely because it submitted an infrastructure transaction.

- **Policy Owner (Human / DAO)**: Commits intent constraints; holds no custody.
- **Transaction Subject (Orion Agent / Smart Account)**: Proposes or executes transactions; cannot attest to its own actions.
- **Attesting Evaluator**: Independent service holding `EVALUATOR_ROLE`; signs EIP-712 receipts; cannot touch user funds.

---

## 5. Comprehensive Verification Suite (42 / 42 Passing)

IntentGuard is validated across three independent test runners with 100% green coverage:

```text
 ✓ server/auth.logout.test.ts (1)        
 ✓ server/intentguard/baseRpc.test.ts (3)             
 ✓ server/intentguard/crypto.test.ts (5)                                                
 ✓ server/intentguard/policy.test.ts (6)                                                      
 ✓ server/routers/intentguard.test.ts (1)                                              
 ✓ scripts/deploy.test.ts (1)     
 (17 Vitest unit & RPC integration tests passed)

  IntentGuardPolicyRegistry (2 passed)
  IntentGuardReceiptRegistry (6 passed)
  IntentGuardTargetRegistry (1 passed)
  (9 Hardhat contract & gas tracking tests passed)

  Engine, Tokens, & Invariant Fuzz Suite (16 passed)
  • Exact ERC-20 approval matches
  • Unlimited approval blocked (IG-APPROVE-001)
  • Rogue spender blocked (IG-APPROVE-002)
  • Unknown selectors fail closed (IG-SELECTOR-001)
  • Dynamic token metadata resolver & precision conversion (4 passed)
  • Invariant: Overspend amounts deterministically rejected from MATCH
  • Invariant: Non-allowlisted recipients deterministically rejected from MATCH
  • Invariant: Malformed / truncated calldata safely fails closed
  (16 Node/TSX engine & fuzz tests passed)

  TypeScript Compiler Check (tsc --noEmit): 0 ERRORS
```

## 6. V2 Roadmap

- **Pre-execution state simulation**: Native dry-run trace evaluation alongside calldata decoding.
- **Runtime enforcement packages**: Drop-in middleware for Orion and other autonomous agent runtimes.
- **Smart Account / Safe execution hooks**: Programmable policy modules for explicit account verification.
- **Expanded protocol coverage**: Independently audited decoders for complex protocols (Permit2, Universal Router).
- **Cross-chain intent verification**: Interoperable policy attestations across the Superchain.
- **Persistent forensic verification history**: Indexing and public querying for attestation receipts.

---

## 7. Quickstart & Demo Commands

```bash
# 1. Install dependencies
npm install

# 2. Run development server (Frontend + Backend)
npm run dev

# 3. Run the full 42-test verification suite
npm run test:all

# 4. Run the flagship Orion Agent integration demo
npx tsx examples/orion-integration.ts

# 5. Run the developer CLI audit tool
npm run audit -- --action TRANSFER --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --recipient 0xb8069ea05dca32f8116f1af6bb719155274010fa --max 10000000 --data 0xa9059cbb000000000000000000000000b8069ea05dca32f8116f1af6bb719155274010fa0000000000000000000000000000000000000000000000000000000000989680
```

Open `https://intentguard-drd7.onrender.com` (or `http://localhost:3000` locally) to launch the **IntentGuard Forensic Signal Workspace**.

---

## 8. Hackathon Submission & Team

- **Project**: IntentGuard
- **Track**: Autonomous AI Agents / Security & Infrastructure on Base (Orion Agent Hackathon)
- **Status**: Submission-Ready MVP
- **Author**: Aje Oluwaseun Isaac ([@0xaje](https://github.com/0xaje))
- **Repository**: [github.com/0xaje/IntentGuard](https://github.com/0xaje/IntentGuard)
- **License**: MIT License

