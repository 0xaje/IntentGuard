# IntentGuard

<div align="center">

### Deterministic Intent Verification & Cryptographic Attestation Layer for Autonomous AI Agents on Base

[![CI / Test Suite](https://img.shields.io/badge/Tests-38%2F38%20Passing-emerald?style=flat-square)](https://github.com/0xaje/IntentGuard)
[![Base Mainnet](https://img.shields.io/badge/Network-Base%20Mainnet%20(8453)-blue?style=flat-square)](https://base.org)
[![Base Sepolia](https://img.shields.io/badge/Attestation-Base%20Sepolia%20(84532)-purple?style=flat-square)](https://sepolia.basescan.org)
[![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

[**Live Demo App**](http://localhost:3000/app) · [**Pitch Deck**](presentation/intentguard_pitch_deck.md) · [**Judge Q&A Playbook**](presentation/judge_qa_playbook.md) · [**Architecture**](presentation/intentguard_architecture.mmd)

</div>

---

## 🌟 Executive Summary & Problem Statement

Autonomous AI agents (Orion Agent, Coinbase AgentKit, ElizaOS, LangChain) are rapidly being deployed on-chain with spending power and execution autonomy. However, **giving LLMs direct access to private keys or transaction execution without deterministic guardrails is catastrophic:**

1. **Prompt Injection & Hijacks**: Attackers trick autonomous agents into draining funds to unverified attacker addresses.
2. **Calldata Hallucinations**: LLMs construct incorrect recipients, wrong tokens, excessive slippage tolerances, or unlimited `type(uint256).max` token approvals.
3. **Execution Drift**: Quoted DEX prices drift between LLM planning and transaction broadcast, causing sandwich attacks and slippage losses.
4. **The "LLM-Policing-LLM" Fallacy**: Relying on a second LLM to "audit" the first LLM is non-deterministic, expensive, unprovable, and vulnerable to jailbreaks.

### The Solution: IntentGuard
**IntentGuard is a deterministic intent-verification and cryptographic attestation layer for autonomous agents on Base.**

> [!IMPORTANT]
> **The Core Thesis: "The LLM may interpret intent. It NEVER decides whether a transaction is safe."**
> IntentGuard strictly isolates natural language interpretation from safety evaluation:
> - **LLM Role**: Translates user prompts into a strongly typed `IntentSpec` schema (Zod validated).
> - **Deterministic Engine Role**: Computes the safety verdict (`MATCH` / `MISMATCH` / `CANNOT_VERIFY`) using 100% pure arithmetic, contract allowlists, and observable Base blockchain logs.
> - **Attestation Layer**: Generates an EIP-712 cryptographically signed receipt anchored directly to Base Sepolia smart contracts.

---

## 🛡️ The Two Distinct Security Stages

IntentGuard explicitly distinguishes between two security boundaries in autonomous agent workflows:

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        INTENTGUARD STAGES                                         │
├─────────────────────────────────────────┬─────────────────────────────────────────────────────────┤
│             STAGE A: PRE-EXECUTION      │             STAGE B: POST-EXECUTION                     │
│ "Can this proposed transaction safely   │ "Did the transaction that actually mined on Base       │
│  proceed according to declared intent?" │  remain 100% faithful to the declared human intent?"    │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ • Validates calldata against allowlist  │ • Inspects mined Base Mainnet receipts & block logs     │
│ • Simulates quotes (Uniswap QuoterV2)   │ • Decodes emitted ERC-20 Transfer & Approval events     │
│ • Checks recipient & allowance bounds   │ • Measures actual executed slippage against limits      │
│ • Preflight deterministic policy pass   │ • EIP-712 Attestation anchored to Base Sepolia registry │
└─────────────────────────────────────────┴─────────────────────────────────────────────────────────┘
```

---

## 🤖 Orion Agent & Multi-Framework Ecosystem Integration

IntentGuard is built as a plug-and-play middleware for the leading Web3 autonomous agent frameworks.

```text
               HUMAN USER
                   │
                   │ Declares Intent ("Transfer 10 USDC to Alice on Base")
                   ▼
          ┌─────────────────┐
          │   ORION AGENT   │ ──► Proposes Candidate Transaction
          └────────┬────────┘
                   │
                   │ ProposedRequest (Target, Calldata, Value)
                   ▼
       ┌───────────────────────┐
       │      INTENTGUARD      │
       │                       │
       │ • Calldata Decoder    │
       │ • Policy Rules        │
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
 EIP-712 Attestation Anchored to Base Sepolia
```

### 1. Orion Agent Zero-Custody Attestation Loop
Orion agents operate with complete non-custodial safety:
- The Orion agent plans the route and emits a candidate `ProposedRequest`.
- IntentGuard verifies that the candidate calldata strictly respects the human's constraints.
- Upon successful execution, the on-chain receipt serves as an immutable **Proof of Agent Fidelity** for reputation and reward release.

### 2. 3-Line TypeScript Middleware
```typescript
import { verifyAgentAction } from "intentguard";

export function withIntentGuard(intent, sendTransaction) {
  return async (proposedRequest) => {
    const check = verifyAgentAction({ intent, request: proposedRequest });
    if (!check.isSafe) {
      throw new Error(`[IntentGuard BLOCKED] ${check.primaryReasonCode}: ${check.explanation}`);
    }
    return sendTransaction(proposedRequest);
  };
}
```

### 3. Coinbase AgentKit Action Provider ([`examples/agentkit-integration.ts`](examples/agentkit-integration.ts))
```typescript
import { IntentGuardAgentKitProvider } from "@intentguard/agentkit";

const guard = new IntentGuardAgentKitProvider(humanPolicy);
const eval = guard.evaluateAction(agentKitAction);
if (!eval.isApproved) {
  throw new Error(`Blocked by IntentGuard: ${eval.explanation}`);
}
```

### 4. ElizaOS Evaluator Plugin ([`examples/eliza-integration.ts`](examples/eliza-integration.ts))
```typescript
import { intentGuardElizaPlugin } from "@intentguard/plugin-eliza";

runtime.registerPlugin(intentGuardElizaPlugin);
// Eliza automatically validates transaction intent before tool execution.
```

### 5. Developer Terminal CLI ([`scripts/cli.ts`](scripts/cli.ts))
```bash
# Run instant CLI audit in terminal or CI pipeline:
npm run audit -- \
  --action TRANSFER \
  --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --recipient 0xb8069ea05dca32f8116f1af6bb719155274010fa \
  --max 10000000 \
  --data 0xa9059cbb000000000000000000000000b8069ea05dca32f8116f1af6bb719155274010fa0000000000000000000000000000000000000000000000000000000000989680
```

---

## 🔒 Cryptographic Trust Loop & Smart Contracts

IntentGuard anchors its deterministic verdicts to immutable Solidity smart contracts on **Base Sepolia**:

| Contract | Network | Canonical Address | Purpose |
|---|---|---|---|
| **`IntentGuardPolicyRegistry`** | Base Sepolia (`84532`) | `0x45DF2847c1f8d8b67195861F1a2a4bE13f48a924` | User-owned policy commitments & keccak256 intent hashes |
| **`IntentGuardReceiptRegistry`** | Base Sepolia (`84532`) | `0x6f31A8B28a6f95886dF02B487c6fBEB5F95C48A1` | EIP-712 evaluator signature verification & receipt anchoring |
| **`IntentGuardTargetRegistry`** | Base Sepolia (`84532`) | `0x19f2a7a40C3B7f8A2aE72d8a57A250fD2A20B71b` | Allowlisted contract addresses, routers, and function selectors |

### Strict Security Invariant: Subject Separation
IntentGuard mathematically separates the entities in the verification lifecycle:

$$\mathbf{policyOwner} \neq \mathbf{transactionSubject} \neq \mathbf{evaluator}$$

- **Policy Owner (Human / DAO)**: Commits intent constraints; holds no custody.
- **Transaction Subject (AI Agent / Smart Account)**: Proposes or executes transactions; cannot attest to its own actions.
- **Attesting Evaluator**: Independent service holding `EVALUATOR_ROLE`; signs EIP-712 receipts; cannot touch user funds.

---

## 🧪 Comprehensive Test Suite (38 / 38 Passing)

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

## 🚀 Quickstart & Local Setup

### Prerequisites
- **Node.js**: `v20+` (or `v22+`)
- **Package Manager**: `npm` or `pnpm`

### Installation & Run
```bash
# 1. Clone repository
git clone https://github.com/0xaje/IntentGuard.git
cd IntentGuard

# 2. Install dependencies
npm install

# 3. Run development server (Frontend + Backend)
npm run dev

# 4. Run the full 38-test verification suite
npm run test:all

# 5. Run the developer CLI audit tool
npm run audit -- --help

# 6. Run framework integration demos
npx tsx examples/agentkit-integration.ts
npx tsx examples/eliza-integration.ts
```

Open `http://localhost:3000/app` to launch the **IntentGuard Forensic Signal Workspace**.

---

## 📂 Repository Structure

```text
IntentGuard/
├── client/              # React 19 + Tailwind CSS Forensic Signal UI
│   ├── src/pages/       # Workspace & Interactive Scenario Consoles
│   └── src/components/  # Multi-framework SDK Drawer, Origin Tree, Badges
│
├── engine/              # Pure, deterministic TypeScript verification engine
│   ├── src/canonical/   # Deterministic JSON canonicalization & keccak256 hashing
│   ├── src/decoder/     # Calldata decoders (Uniswap V3, ERC-20, Permits)
│   ├── src/policy/      # Deterministic policy rules & fail-closed engine
│   ├── src/receipt/     # Canonical EIP-712 receipt builder
│   ├── src/sdk.ts       # Top-level SDK convenience helpers
│   └── test/            # Engine unit tests & property-based fuzz invariants
│
├── contracts/           # Solidity smart contracts on Base Sepolia
│   ├── interfaces/      # Contract interfaces & type declarations
│   ├── IntentGuardPolicyRegistry.sol
│   ├── IntentGuardReceiptRegistry.sol
│   ├── IntentGuardTargetRegistry.sol
│   └── test/            # Hardhat test suite with gas benchmarking
│
├── server/              # Non-custodial backend gateway & RPC proxy
│   ├── intentguard/     # Base JSON-RPC client, QuoterV2, & token metadata resolver
│   └── routers/         # tRPC API procedures
│
├── examples/            # Runnable framework integration examples
│   ├── agent-middleware.ts      # 3-line universal agent middleware
│   ├── agentkit-integration.ts  # Coinbase AgentKit Action Provider
│   └── eliza-integration.ts     # ElizaOS Evaluator Plugin
│
├── scripts/             # Deployment, Base Sepolia verification, & CLI audit tool
└── presentation/        # Pitch deck, judge Q&A playbook, and demo scripts
```

---

## 👥 Hackathon Submission & Team

- **Project**: IntentGuard
- **Track**: Autonomous AI Agents / Security & Infrastructure on Base (Orion Agent Hackathon)
- **Author**: Aje Oluwaseun Isaac ([@0xaje](https://github.com/0xaje))
- **License**: MIT License
