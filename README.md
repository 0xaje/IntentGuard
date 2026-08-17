# IntentGuard

IntentGuard is a **non-custodial, read-only Base intent verification platform**. It parses structured intents, inspects on-chain Base Mainnet transactions, decodes supported transaction paths deterministically, and provides verifiable `MATCH`, `MISMATCH`, or `UNVERIFIABLE` verdicts accompanied by signed EIP-712 evidence receipts anchored to Base Sepolia smart contracts.

The platform does not connect a wallet, request seed phrases or private keys, move funds, sign transactions on behalf of users, or fabricate blockchain evidence.

---

## Key Capabilities

| Capability | Behavior & Safety Guarantee |
|---|---|
| **Base Mainnet Inspection** | Reads live transaction, mined receipt, event log, and state data directly via server-side Base JSON-RPC. |
| **Supported Transaction Decoding** | Decodes ERC-20 approvals (`approve`), transfers (`transfer`, `transferFrom`), and allowlisted Uniswap V3 `SwapRouter02.exactInputSingle` routes. |
| **Evidence Enrichment** | Resolves router-path ERC-20 symbol/decimals through read-only calls and queries read-only QuoterV2 estimates where applicable. |
| **Deterministic Verdicts** | Strict policy checks producing `MATCH`, `MISMATCH`, or `UNVERIFIABLE`. Missing evidence fails closed. |
| **Cryptographic Trust Loop** | Computes canonical intent, request, and evidence hashes, and anchors EIP-712 evaluator-signed receipts to Base Sepolia contracts. |
| **Interactive Forensic Signal UI** | Modern, responsive dashboard showing transaction signals, policy checks, raw evidence payloads, and review boundaries. |
| **Human Review Boundary** | Gated non-signing review acknowledgement enabled only for verified `MATCH` results. |

---

## Trust Architecture & Boundaries

```text
               +---------------------------------------------+
               | User / DApp Intent Definition               |
               +---------------------------------------------+
                                      |
                                      v
               +---------------------------------------------+
               | Deterministic Policy Engine & Decoder       |
               +---------------------------------------------+
                                      |
                         +------------+------------+
                         |                         |
                         v                         v
               +-------------------+     +-------------------+
               | Base Mainnet RPC  |     | Base Sepolia      |
               | (Live Evidence)   |     | Registry / Trust  |
               +-------------------+     +-------------------+
                         |                         |
                         +------------+------------+
                                      |
                                      v
               +---------------------------------------------+
               | EIP-712 Signed Receipt (MATCH/MISMATCH/...) |
               +---------------------------------------------+
```

### Trust Boundary Rules
- **Non-custodial**: IntentGuard never holds, manages, or routes tokens.
- **Fail-closed**: Unknown selectors or missing RPC evidence yield `UNVERIFIABLE` or `MISMATCH`, never `MATCH`.
- **Infrastructure separation**: The policy committer/evaluator is distinct from the actual Base transaction subject.

The EIP-712 Receipt Type Hash:
```text
0x5c788492ed74a4250160711fd75d8e65b3e4d1b2499ff212473192503136d645
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
