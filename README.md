# IntentGuard

<div align="center">

### Deterministic Intent Verification & Cryptographic Attestation Layer for Orion AI Agents on Base

[![Live Demo](https://img.shields.io/badge/Live%20App-intentguard.onrender.com-success?style=flat-square&logo=render)](https://intentguard-drd7.onrender.com)
[![CI / Test Suite](https://img.shields.io/badge/Tests-38%2F38%20Passing-emerald?style=flat-square)](https://github.com/0xaje/IntentGuard)
[![Base Mainnet](https://img.shields.io/badge/Verification-Base%20Mainnet%20(8453)-blue?style=flat-square)](https://base.org)
[![Base Sepolia](https://img.shields.io/badge/Attestation-Base%20Sepolia%20(84532)-purple?style=flat-square)](https://sepolia.basescan.org)
[![Orion Agent](https://img.shields.io/badge/Framework-Orion%20Agent%20Ready-orange?style=flat-square)](https://github.com/0xaje/IntentGuard)
[![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

[**🌐 Live Application**](https://intentguard-drd7.onrender.com) · [**Pitch Deck**](presentation/intentguard_pitch_deck.md) · [**Judge Q&A Playbook**](presentation/judge_qa_playbook.md) · [**Architecture**](presentation/intentguard_architecture.mmd)

</div>

---

## 🌟 What We Are Building: The Intent Fidelity Layer for Orion Agents

**IntentGuard** is a zero-custody, zero-LLM deterministic security and cryptographic attestation layer built specifically for **autonomous Orion Agents executing on Base**.

As autonomous AI agents like **Orion** take on complex DeFi routing, token transfers, DEX swaps, and multi-step on-chain operations, they face critical security threats:
- **Prompt Injection & Hijacks**: Malicious inputs tricking an Orion agent into rerouting funds to an unauthorized address.
- **Calldata Hallucination**: Orion agents inadvertently constructing invalid recipient parameters, wrong token contracts, or excessive spend allowances (`type(uint256).max`).
- **Execution Drift**: Slippage and liquidity shifts between the agent's planning phase and blockchain mining.

### 🛡️ The Zero-LLM Deterministic Guarantee
> **"The Orion LLM interprets human intent. It NEVER decides whether a transaction is safe."**
>
> 1. **Intent Extraction**: The user's natural language goal is parsed into a strictly validated `IntentSpec` schema.
> 2. **Deterministic Evaluation**: IntentGuard's pure arithmetic policy engine checks proposed calldata against constraints (spend limits, allowlisted spenders/recipients, slippage bounds).
> 3. **Cryptographic Attestation**: Computes canonical hashes and anchors evaluator-signed **EIP-712 receipts** to smart contracts on Base Sepolia, producing an immutable **Proof of Agent Fidelity**.

---

## 🤖 The Orion Agent Trust Architecture

```text
                              HUMAN USER
                                  │
                                  │ Declares Intent ("Swap $50 USDC for ETH on Base, max 1% slippage")
                                  ▼
                         ┌─────────────────┐
                         │   ORION AGENT   │ ──► Plans Route & Generates Calldata
                         └────────┬────────┘
                                  │
                                  │ ProposedRequest (Target, Calldata, Value, Nonce)
                                  ▼
                      ┌───────────────────────┐
                      │      INTENTGUARD      │
                      │                       │
                      │ • Calldata Decoder    │
                      │ • Policy Engine       │
                      │ • Deterministic Math  │
                      └───────────┬───────────┘
                                  │
                       ┌──────────┴──────────┐
                       ▼                     ▼
                    🟢 MATCH              🔴 MISMATCH
                       │                     │
                       ▼                     ▼
                Broadcast to Base     FAIL-CLOSED (Execution Aborted)
                       │
                       ▼
                Mined Base Receipt
                       │
                       ▼
         EIP-712 Receipt Anchored to Base Sepolia
                       │
                       ▼
       Orion Agent Reputation & Escrow Settlement
```

### 1. Orion Zero-Custody Agent Operation
- The **Orion Agent** plans execution without ever holding user seed phrases or private keys.
- If the Orion agent constructs a valid transaction $\rightarrow$ IntentGuard returns `MATCH` (`canExecute: true`).
- If an attack or hallucination violates constraints $\rightarrow$ IntentGuard returns `MISMATCH` (`canExecute: false`) with strict failure codes (`IG-SPEND-001`, `IG-RECIPIENT-001`, `IG-APPROVE-001`).

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

## ⚡ Multi-Framework Adapter Support

In addition to native Orion Agent support, IntentGuard provides drop-in adapters for the broader AI agent ecosystem:

| Framework | Integration File | Description |
|---|---|---|
| **Orion Agent (Primary)** | [`examples/orion-integration.ts`](examples/orion-integration.ts) | Flagship zero-custody planning guardrail and Base Sepolia attestation |
| **Coinbase AgentKit** | [`examples/agentkit-integration.ts`](examples/agentkit-integration.ts) | Action Provider middleware for Base AgentKit runners |
| **ElizaOS Plugin** | [`examples/eliza-integration.ts`](examples/eliza-integration.ts) | Action evaluator plugin for Eliza agent runtimes |
| **Universal 3-Line Middleware** | [`examples/agent-middleware.ts`](examples/agent-middleware.ts) | Generic wrapper for any autonomous agent dispatcher |
| **Developer Terminal CLI** | [`scripts/cli.ts`](scripts/cli.ts) | Terminal & CI/CD audit tool (`npm run audit`) |

---

## 🔒 Cryptographic Smart Contracts on Base Sepolia

IntentGuard anchors its deterministic verdicts to immutable Solidity registries deployed on **Base Sepolia**:

| Contract | Network | Address | Purpose |
|---|---|---|---|
| **`IntentGuardPolicyRegistry`** | Base Sepolia (`84532`) | `0x45DF2847c1f8d8b67195861F1a2a4bE13f48a924` | User-owned policy commitments & keccak256 intent hashes |
| **`IntentGuardReceiptRegistry`** | Base Sepolia (`84532`) | `0x6f31A8B28a6f95886dF02B487c6fBEB5F95C48A1` | EIP-712 evaluator signature verification & receipt anchoring |
| **`IntentGuardTargetRegistry`** | Base Sepolia (`84532`) | `0x19f2a7a40C3B7f8A2aE72d8a57A250fD2A20B71b` | Curated registry for allowlisted contracts & function selectors |

### Security Invariant: Strict Subject Separation
IntentGuard mathematically isolates entities to guarantee objectivity:

$$\mathbf{policyOwner} \neq \mathbf{transactionSubject} \neq \mathbf{evaluator}$$

- **Policy Owner (Human / DAO)**: Commits intent constraints; holds no custody.
- **Transaction Subject (Orion Agent / Smart Account)**: Proposes or executes transactions; cannot attest to its own actions.
- **Attesting Evaluator**: Independent service holding `EVALUATOR_ROLE`; signs EIP-712 receipts; cannot touch user funds.

---

## 🧪 Comprehensive Verification Suite (38 / 38 Passing)

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

  Engine & Invariant Fuzz Suite (12 passed)
  • Exact ERC-20 approval matches
  • Unlimited approval blocked (IG-APPROVE-001)
  • Rogue spender blocked (IG-APPROVE-002)
  • Unknown selectors fail closed (IG-SELECTOR-001)
  • Invariant: Overspend amounts mathematically impossible to MATCH
  • Invariant: Non-allowlisted recipients mathematically impossible to MATCH
  • Invariant: Malformed / truncated calldata safely fails closed
  (12 Node/TSX engine & fuzz tests passed)

  TypeScript Compiler Check (`tsc --noEmit`): 0 ERRORS
```

---

## 🚀 Quickstart & Demo Commands

```bash
# 1. Install dependencies
npm install

# 2. Run development server (Frontend + Backend)
npm run dev

# 3. Run the full 38-test verification suite
npm run test:all

# 4. Run the flagship Orion Agent integration demo
npx tsx examples/orion-integration.ts

# 5. Run the developer CLI audit tool
npm run audit -- --action TRANSFER --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --recipient 0xb8069ea05dca32f8116f1af6bb719155274010fa --max 10000000 --data 0xa9059cbb000000000000000000000000b8069ea05dca32f8116f1af6bb719155274010fa0000000000000000000000000000000000000000000000000000000000989680
```

Open `https://intentguard-drd7.onrender.com` (or `http://localhost:3000` locally) to launch the **IntentGuard Forensic Signal Workspace**.

---

## 👥 Hackathon Submission & Team

- **Project**: IntentGuard
- **Track**: Autonomous AI Agents / Security & Infrastructure on Base (Orion Agent Hackathon)
- **Author**: Aje Oluwaseun Isaac ([@0xaje](https://github.com/0xaje))
- **Repository**: [github.com/0xaje/IntentGuard](https://github.com/0xaje/IntentGuard)
- **License**: MIT License
