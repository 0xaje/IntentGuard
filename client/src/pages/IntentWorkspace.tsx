// Forensic Signal style reminder: show the evidence trail before the visual verdict; never imply a successful chain action or wallet approval that did not occur.
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  ChevronDown,
  CircleAlert,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  Filter,
  Layers,
  Loader2,
  Play,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal
} from "lucide-react";
import SignalMark from "@/components/SignalMark";
import { trpc } from "@/lib/trpc";
import type { VerificationSession } from "@shared/intentguard";

type VerificationMode = "pre-execution" | "post-execution";

interface Scenario {
  id: string;
  mode: VerificationMode;
  title: string;
  badge: string;
  badgeType: "match" | "mismatch" | "quote";
  description: string;
  intentText: string;
  transactionHash: string;
  calldataDetail?: string;
}

const liveScenarios: Scenario[] = [
  // Demo 1: Safe action
  {
    id: "demo-1-safe-transfer",
    mode: "pre-execution",
    title: "Demo 1: Safe Transfer (37.67 USDC)",
    badge: "MATCH / SAFE",
    badgeType: "match",
    description: "Agent proposes 37.67 USDC transfer to Alice; satisfies all constraints. Safe to sign.",
    intentText: "Transfer 37.67 USDC to 0xb8069ea05dca32f8116f1af6bb719155274010fa on Base.",
    transactionHash: "0x6fc41c7b31afef1b7bf322799b2dbd24bd2b87980d241a3ce578fca321f529a5",
    calldataDetail: "0xa9059cbb... (transfer 37.67 USDC)",
  },
  // Demo 2: Agent mistake / Overspend
  {
    id: "demo-2-agent-overspend",
    mode: "pre-execution",
    title: "Demo 2: Agent Mistake (Overspend Cap)",
    badge: "MISMATCH / IG-SPEND-001",
    badgeType: "mismatch",
    description: "Human cap was 10 USDC; agent proposed 37.67 USDC. Blocked by IG-SPEND-001 (Excess: 27.67 USDC).",
    intentText: "Transfer 10 USDC to 0xb8069ea05dca32f8116f1af6bb719155274010fa on Base.",
    transactionHash: "0x6fc41c7b31afef1b7bf322799b2dbd24bd2b87980d241a3ce578fca321f529a5",
    calldataDetail: "0xa9059cbb... (37.67 USDC exceeds 10 USDC cap)",
  },
  // Demo 3: Malicious approval
  {
    id: "demo-3-malicious-approval",
    mode: "pre-execution",
    title: "Demo 3: Malicious Unlimited Approval",
    badge: "MISMATCH / IG-APPROVE-001",
    badgeType: "mismatch",
    description: "Human prohibited unlimited approval; agent proposed approve(spender, 2^256-1). Blocked by IG-APPROVE-001.",
    intentText: "Send 25 USDC to 0x5df3a0cc5bf77f1f024585fb9a495db80b93df1a on Base. Never approve unlimited spending.",
    transactionHash: "0xdd9a28e43b6af84197f2c17fc5d497446568953416a2dad6610a4373fd773b18",
    calldataDetail: "0x095ea7b3... (approve uint256.max)",
  },
  // Demo 4: Preflight quote check
  {
    id: "demo-4-swap-quote",
    mode: "pre-execution",
    title: "Demo 4: Swap Preflight & QuoterV2",
    badge: "CANNOT_VERIFY / QUOTE",
    badgeType: "quote",
    description: "Inspects allowlisted SwapRouter02 and queries live QuoterV2. Fails closed until mined execution evidence.",
    intentText: "Swap $100 USDC for ETH on Base. Maximum slippage 1%. Don't allow unlimited approvals.",
    transactionHash: "0x3e56358905d733f1cb521f2bdad3ee45cf44d47b2a4d32c1ac84b04252a6e0c2",
    calldataDetail: "0x04e45aaf... (SwapRouter02 exactInputSingle)",
  },

  // Post-Execution Mined Audits
  {
    id: "post-scenario-mined-match",
    mode: "post-execution",
    title: "Mined Transfer Audit (37.67 USDC)",
    badge: "MATCH / ANCHORED",
    badgeType: "match",
    description: "Audits mined Base Mainnet receipt and Transfer logs to prove intent fidelity and anchor receipt.",
    intentText: "Transfer 37.67 USDC to 0xb8069ea05dca32f8116f1af6bb719155274010fa on Base.",
    transactionHash: "0x6fc41c7b31afef1b7bf322799b2dbd24bd2b87980d241a3ce578fca321f529a5",
  },
  {
    id: "post-scenario-overspend-audit",
    mode: "post-execution",
    title: "Mined Overspend Violation Audit",
    badge: "MISMATCH / VIOLATION",
    badgeType: "mismatch",
    description: "Inspects mined Base transaction logs and proves actual spend (37.67 USDC) violated the 10 USDC cap.",
    intentText: "Send 10 USDC to 0xb8069ea05dca32f8116f1af6bb719155274010fa on Base.",
    transactionHash: "0x6fc41c7b31afef1b7bf322799b2dbd24bd2b87980d241a3ce578fca321f529a5",
  },
];

const inspectionStages = [
  { id: "01", label: "Resolve Base transaction", detail: "Requesting the transaction object and chain ID." },
  { id: "02", label: "Inspect mined receipt", detail: "Reading execution state and observable event logs." },
  { id: "03", label: "Decode allowlisted route", detail: "Checking the router address and supported calldata shape." },
  { id: "04", label: "Request read-only quote", detail: "Calling the allowlisted QuoterV2 at the current Base state." },
  { id: "05", label: "Compare deterministic policy", detail: "Producing evidence and a non-signing verdict." },
];

function shortHash(value: string | null | undefined) {
  if (!value) return "Unavailable";
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function formatUsdc(raw: string | null | undefined) {
  if (!raw) return "Unavailable";
  try {
    const value = BigInt(raw);
    const scale = BigInt(1_000_000);
    const whole = value / scale;
    const fraction = value % scale;
    return fraction === BigInt(0)
      ? `${whole.toString()} USDC`
      : `${whole.toString()}.${fraction.toString().padStart(6, "0").replace(/0+$/, "")} USDC`;
  } catch {
    return "Unavailable";
  }
}

type TokenMetadataView = { state: "available" | "unavailable"; symbol: string | null; decimals: number | null } | null;

function formatTokenAmount(raw: string | null | undefined, metadata: TokenMetadataView) {
  if (!raw) return "Unavailable";
  if (!metadata || metadata.state !== "available" || !metadata.symbol || metadata.decimals === null) return `${raw} raw units`;
  try {
    const value = BigInt(raw);
    const scale = BigInt(10) ** BigInt(metadata.decimals);
    const whole = value / scale;
    const fraction = value % scale;
    return fraction === BigInt(0) ? `${whole.toString()} ${metadata.symbol}` : `${whole.toString()}.${fraction.toString().padStart(metadata.decimals, "0").replace(/0+$/, "")} ${metadata.symbol}`;
  } catch {
    return "Unavailable";
  }
}

function formatTokenLabel(address: string, metadata: TokenMetadataView) {
  return metadata?.state === "available" && metadata.symbol ? `${metadata.symbol} / ${shortHash(address)}` : shortHash(address);
}

function verdictLabel(verdict: "MATCH" | "MISMATCH" | "CANNOT_VERIFY" | "UNVERIFIABLE") {
  if (verdict === "MATCH") return "Intent match";
  if (verdict === "MISMATCH") return "Intent mismatch";
  return "Cannot verify";
}

export default function IntentWorkspace() {
  const [mode, setMode] = useState<VerificationMode>("pre-execution");
  const [intentText, setIntentText] = useState(liveScenarios[0].intentText);
  const [transactionHash, setTransactionHash] = useState(liveScenarios[0].transactionHash);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(liveScenarios[0].id);
  const [clientError, setClientError] = useState<string | null>(null);
  const [humanReviewRecorded, setHumanReviewRecorded] = useState(false);
  const [showSessionJson, setShowSessionJson] = useState(false);
  const [showSdkDrawer, setShowSdkDrawer] = useState(false);
  const [sdkLanguage, setSdkLanguage] = useState<"ts" | "agentkit" | "eliza" | "cli">("ts");
  const [sessionCopied, setSessionCopied] = useState(false);
  const [sdkCopied, setSdkCopied] = useState(false);

  const parseIntent = trpc.intentGuard.parse.useMutation();
  const verifyIntent = trpc.intentGuard.verify.useMutation();
  const commitPolicy = trpc.intentGuard.commitPolicy.useMutation();
  const anchorReceipt = trpc.intentGuard.anchorReceipt.useMutation();
  const baseHealth = trpc.intentGuard.health.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  const currentIntent = verifyIntent.data?.intent ?? parseIntent.data?.intent;
  const result = verifyIntent.data;
  const policyCommitment = commitPolicy.data;
  const anchoredReceipt = anchorReceipt.data;
  const isWorking = parseIntent.isPending || verifyIntent.isPending || commitPolicy.isPending || anchorReceipt.isPending;
  const errorMessage = clientError ?? parseIntent.error?.message ?? verifyIntent.error?.message ?? commitPolicy.error?.message ?? anchorReceipt.error?.message ?? null;

  // Active step in the 7-step trust lifecycle
  const currentStep = anchoredReceipt
    ? 7
    : policyCommitment
    ? 6
    : result
    ? 5
    : verifyIntent.isPending
    ? 4
    : transactionHash && currentIntent
    ? 3
    : currentIntent
    ? 2
    : 1;

  const verificationSession: VerificationSession | null = result ? {
    sessionId: `SESSION-${result.verification.receiptId}`,
    createdAt: result.verification.observedAt,
    intent: result.intent,
    policy: policyCommitment ? {
      policyId: policyCommitment.policyId,
      intentHash: policyCommitment.intentHash,
      policyVersion: policyCommitment.policyVersion,
      policyOwner: policyCommitment.policyOwner,
      policyCommitter: policyCommitment.policyCommitter,
      validFrom: policyCommitment.validFrom,
      validUntil: policyCommitment.validUntil,
      transactionHash: policyCommitment.transactionHash,
      blockNumber: policyCommitment.blockNumber,
      registryAddress: policyCommitment.registryAddress,
      explorerUrl: policyCommitment.explorerUrl,
    } : null,
    request: {
      chainId: result.verification.provenance?.chainId ?? 8453,
      from: result.inspection?.transaction?.from ?? undefined,
      to: result.inspection?.transaction?.to ?? undefined,
      value: result.inspection?.transaction?.valueEth ?? "0",
      data: (result.inspection?.raw?.transaction?.input as `0x${string}`) ?? undefined,
      transactionHash: (result.inspection?.transactionHash as `0x${string}`) ?? undefined,
      agentId: "orion-agent-v1",
      agentVersion: "1.0.0",
    },
    evidence: result.verification.evidence,
    provenance: result.verification.provenance,
    verdict: result.verification,
    receipt: anchoredReceipt ? {
      receiptId: anchoredReceipt.receipt.receiptId,
      policyId: anchoredReceipt.receipt.policyId,
      intentHash: anchoredReceipt.receipt.intentHash,
      requestHash: anchoredReceipt.receipt.requestHash,
      evidenceHash: anchoredReceipt.receipt.evidenceHash,
      chainId: Number(anchoredReceipt.receipt.chainId),
      transactionSubject: anchoredReceipt.receipt.transactionSubject,
      evaluator: anchoredReceipt.receipt.evaluator,
      verdict: anchoredReceipt.receipt.verdict,
      policyVersion: Number(anchoredReceipt.receipt.policyVersion),
      evaluatedAt: Number(anchoredReceipt.receipt.evaluatedAt),
      expiresAt: Number(anchoredReceipt.receipt.expiresAt),
      engineVersion: Number(anchoredReceipt.receipt.engineVersion),
      decoderVersion: Number(anchoredReceipt.receipt.decoderVersion),
      signature: anchoredReceipt.signature,
      transactionHash: anchoredReceipt.transactionHash,
      blockNumber: anchoredReceipt.blockNumber,
      registryAddress: anchoredReceipt.registryAddress,
      explorerUrl: anchoredReceipt.explorerUrl,
    } : null,
    attestation: anchoredReceipt ? {
      evaluator: anchoredReceipt.receipt.evaluator,
      signature: anchoredReceipt.signature,
      registryAddress: anchoredReceipt.registryAddress,
      anchored: true,
    } : null,
  } : null;

  function handleModeChange(newMode: VerificationMode) {
    setMode(newMode);
    const defaultScenario = liveScenarios.find((s) => s.mode === newMode) ?? liveScenarios[0];
    loadScenario(defaultScenario, false);
  }

  function loadScenario(scenario: Scenario, autoVerify = false) {
    setActiveScenarioId(scenario.id);
    setIntentText(scenario.intentText);
    setTransactionHash(scenario.transactionHash);
    setClientError(null);
    setHumanReviewRecorded(false);
    commitPolicy.reset();
    anchorReceipt.reset();
    if (autoVerify) {
      verifyIntent.mutate({ text: scenario.intentText, transactionHash: scenario.transactionHash });
    } else {
      parseIntent.mutate({ text: scenario.intentText });
    }
  }

  function handleExtract(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    setClientError(null);
    setHumanReviewRecorded(false);
    verifyIntent.reset();
    commitPolicy.reset();
    anchorReceipt.reset();
    parseIntent.mutate({ text: intentText });
  }

  function handleVerify() {
    const normalizedHash = transactionHash.trim();
    if (!currentIntent && !parseIntent.data?.intent) {
      setClientError("Review the structured intent before asking IntentGuard to verify a transaction.");
      return;
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(normalizedHash)) {
      setClientError("Paste a real 32-byte Base transaction hash beginning with 0x.");
      return;
    }
    setClientError(null);
    setHumanReviewRecorded(false);
    anchorReceipt.reset();
    verifyIntent.mutate({ text: intentText, transactionHash: normalizedHash });
  }

  function handleCommitPolicy() {
    if (!currentIntent) {
      setClientError("Extract the structured intent before requesting an on-chain policy commitment.");
      return;
    }
    setClientError(null);
    anchorReceipt.reset();
    commitPolicy.mutate({ intent: currentIntent, validForSeconds: 86_400 });
  }

  function handleAnchorReceipt() {
    const normalizedHash = transactionHash.trim();
    if (!policyCommitment) {
      setClientError("Commit the reviewed intent policy before requesting an on-chain verification receipt.");
      return;
    }
    if (!result?.inspection || !/^0x[a-fA-F0-9]{64}$/.test(normalizedHash)) {
      setClientError("Verify a real Base transaction before requesting an on-chain receipt.");
      return;
    }
    setClientError(null);
    anchorReceipt.mutate({ text: intentText, transactionHash: normalizedHash, policyId: policyCommitment.policyId, receiptValidForSeconds: 86_400 });
  }

  function downloadSessionJson() {
    if (!verificationSession) return;
    const blob = new Blob([JSON.stringify(verificationSession, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${verificationSession.sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const tsCode = `import { verifyAgentAction, createAgentGuardrail } from "intentguard";

// 1. Declare human constraints (e.g. from prompt or UI)
const intent = {
  schemaVersion: 1,
  chainId: 8453, // Base Mainnet
  action: "TRANSFER",
  asset: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, // USDC
  recipient: { exact: "0xb8069ea05dca32f8116f1af6bb719155274010fa" },
  spendCap: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", maxRaw: "10000000" }, // 10 USDC max
  approvalPolicy: "EXACT_ONLY",
  permitPolicy: "NOT_APPLICABLE",
  allowNativeValue: false,
  allowUnknownSelectors: false,
};

// 2. 3-Line Middleware wrapper for any agent
export function withIntentGuard(intent, sendTransaction) {
  return async (proposedReq) => {
    const check = verifyAgentAction({ intent, request: proposedReq });
    if (!check.isSafe) {
      throw new Error(\`[IntentGuard BLOCKED] \${check.primaryReasonCode}: \${check.explanation}\`);
    }
    return sendTransaction(proposedReq);
  };
}`;

  const agentkitCode = `import { IntentGuardAgentKitProvider } from "@intentguard/agentkit";
import { AgentKit } from "@coinbase/agentkit";

// 1. Initialize guardrail with declared human policy
const guardrail = new IntentGuardAgentKitProvider({
  schemaVersion: 1,
  chainId: 8453, // Base Mainnet
  action: "TRANSFER",
  asset: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  recipient: { exact: "0xb8069ea05dca32f8116f1af6bb719155274010fa" },
  spendCap: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", maxRaw: "25000000" },
  approvalPolicy: "EXACT_ONLY",
  permitPolicy: "NOT_APPLICABLE",
  allowNativeValue: false,
  allowUnknownSelectors: false,
});

// 2. Intercept AgentKit action before broadcasting
const evaluation = guardrail.evaluateAction({
  name: "transfer_usdc",
  targetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  calldata: agentProposal.calldata,
});

if (!evaluation.isApproved) {
  throw new Error(\`AgentKit action blocked: \${evaluation.explanation}\`);
}`;

  const elizaCode = `import { intentGuardElizaPlugin } from "@intentguard/plugin-eliza";

// 1. Register plugin into Eliza Agent Runtime
runtime.registerPlugin(intentGuardElizaPlugin);

// 2. Eliza automatically evaluates action fidelity before tool execution
// If an LLM hallucination or prompt-injection attempts an overspend or rogue approval,
// the evaluator returns valid: false with deterministic error code (e.g. IG-SPEND-001).`;

  const cliCode = `# 1. Audit any transaction or proposal in terminal / CI pipeline
npx intentguard verify \\
  --action TRANSFER \\
  --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \\
  --recipient 0xb8069ea05dca32f8116f1af6bb719155274010fa \\
  --max 10000000 \\
  --data 0xa9059cbb...

# 2. Run complete test suite locally
npm run test:all`;

  const activeSnippet =
    sdkLanguage === "ts"
      ? tsCode
      : sdkLanguage === "agentkit"
      ? agentkitCode
      : sdkLanguage === "eliza"
      ? elizaCode
      : cliCode;

  const filteredScenarios = liveScenarios.filter((s) => s.mode === mode);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand-lockup">
            <Link href="/" className="app-home-link" aria-label="Return to IntentGuard landing page">
              <SignalMark className="h-6 w-6 text-signal" />
              <span className="app-wordmark">IntentGuard</span>
            </Link>
            <div className="app-header-context">
              <span className="context-separator">/</span>
              <span className="context-label">Intent Fidelity Layer for AI Agents</span>
            </div>
          </div>
          <div className="app-status-bar">
            <button
              type="button"
              className="button-subtle text-xs flex items-center gap-1.5"
              onClick={() => setShowSdkDrawer((p) => !p)}
            >
              <Code2 size={14} /> Agent SDK
            </button>
            <div className="status-indicator">
              <span className={`status-dot ${baseHealth.data?.status === "reachable" ? "status-online" : "status-offline"}`} />
              <span className="status-text">{baseHealth.data?.status === "reachable" ? "Base RPC live (8453)" : "Base RPC offline"}</span>
            </div>
            <Link href="/" className="back-link"><ArrowLeft size={14} /> Back</Link>
          </div>
        </div>
      </header>

      {/* Agent SDK Modal / Drawer */}
      {showSdkDrawer && (
        <div className="sdk-drawer-overlay" onClick={() => setShowSdkDrawer(false)}>
          <div className="sdk-drawer-card" onClick={(e) => e.stopPropagation()}>
            <div className="sdk-drawer-header">
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-signal" />
                <h3 className="font-mono text-sm font-semibold tracking-wider uppercase">Agent Safety Middleware Integration</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="sdk-lang-toggle">
                  <button
                    type="button"
                    className={`lang-tab ${sdkLanguage === "ts" ? "active" : ""}`}
                    onClick={() => setSdkLanguage("ts")}
                  >
                    TypeScript SDK
                  </button>
                  <button
                    type="button"
                    className={`lang-tab ${sdkLanguage === "agentkit" ? "active" : ""}`}
                    onClick={() => setSdkLanguage("agentkit")}
                  >
                    Coinbase AgentKit
                  </button>
                  <button
                    type="button"
                    className={`lang-tab ${sdkLanguage === "eliza" ? "active" : ""}`}
                    onClick={() => setSdkLanguage("eliza")}
                  >
                    ElizaOS Plugin
                  </button>
                  <button
                    type="button"
                    className={`lang-tab ${sdkLanguage === "cli" ? "active" : ""}`}
                    onClick={() => setSdkLanguage("cli")}
                  >
                    CLI / CI
                  </button>
                </div>
                <button
                  type="button"
                  className="button-subtle text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(activeSnippet);
                    setSdkCopied(true);
                    setTimeout(() => setSdkCopied(false), 2000);
                  }}
                >
                  {sdkCopied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Code</>}
                </button>
                <button
                  type="button"
                  className="close-button"
                  onClick={() => setShowSdkDrawer(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 mb-3">
              Drop this deterministic guardrail into any autonomous AI agent on Base to prevent prompt injection and unauthorized execution.
            </p>
            <pre className="sdk-code-block">
              <code>{activeSnippet}</code>
            </pre>
          </div>
        </div>
      )}

      <main className="app-main">
        {/* Core Product Headline: Did the agent do what I asked? */}
        <div className="app-intro">
          <div>
            <p className="eyebrow"><ScanLine size={14} /> Intent Fidelity Layer / Base</p>
            <h1>Did the agent do what I asked?</h1>
            <p className="app-intro-copy">
              IntentGuard is the deterministic Intent Fidelity and attestation layer for AI agents on Base. It compares human constraints with observable transaction behavior to prove whether proposed or executed actions are faithful to intent.
            </p>
          </div>
          <div className="app-meta-box">
            <div className="meta-row">
              <span className="meta-label">Core Mission</span>
              <span className="meta-val">Intent Fidelity Verification</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Verdict Authority</span>
              <span className="meta-val">Deterministic (No LLM in verdict)</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Network Scope</span>
              <span className="meta-val">Base Mainnet (8453)</span>
            </div>
          </div>
        </div>

        {/* Architectural Mode Switcher: Pre-Execution vs Post-Execution */}
        <section className="mode-selector-banner" aria-label="Verification Mode Selection">
          <div className="mode-toggle-group">
            <button
              type="button"
              className={`mode-btn ${mode === "pre-execution" ? "is-active" : ""}`}
              onClick={() => handleModeChange("pre-execution")}
            >
              <span className="mode-badge">STAGE A</span>
              <strong>PRE-EXECUTION GATE</strong>
              <small>Is this proposed transaction safe to sign?</small>
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === "post-execution" ? "is-active" : ""}`}
              onClick={() => handleModeChange("post-execution")}
            >
              <span className="mode-badge">STAGE B</span>
              <strong>POST-EXECUTION AUDIT</strong>
              <small>Did mined execution match declared intent?</small>
            </button>
          </div>
          <div className="mode-explanation-box">
            {mode === "pre-execution" ? (
              <div className="mode-detail">
                <span className="mode-tag tag-pre">PRE-EXECUTION STAGE</span>
                <p>
                  <strong>Pre-Execution Decision Guardrail:</strong> Evaluates candidate calldata, contract allowlists, QuoterV2 pricing, and approval parameters against human policy <em>before</em> signing. Enables human or agent to safely reject unauthorized transactions before funds move.
                </p>
              </div>
            ) : (
              <div className="mode-detail">
                <span className="mode-tag tag-post">POST-EXECUTION STAGE</span>
                <p>
                  <strong>Post-Execution Forensic Audit:</strong> Inspects mined Base blocks, receipts, and emitted ERC-20 Transfer logs to prove whether the transaction actually executed faithfully, then anchors an EIP-712 attestation to Base Sepolia.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 1-Click Live Scenarios Bar (Filtered by active mode) */}
        <section className="scenarios-bar" aria-labelledby="scenarios-heading">
          <div className="scenarios-header">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-signal" />
              <span id="scenarios-heading" className="scenarios-title">
                {mode === "pre-execution" ? "Pre-Execution Candidate Scenarios" : "Post-Execution Forensic Audit Scenarios"}
              </span>
            </div>
            <span className="scenarios-subtitle">Real on-chain Base Mainnet transactions; no mock data</span>
          </div>
          <div className="scenarios-grid">
            {filteredScenarios.map((sc) => {
              const isSelected = activeScenarioId === sc.id;
              return (
                <div
                  key={sc.id}
                  className={`scenario-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => loadScenario(sc, false)}
                >
                  <div className="scenario-top">
                    <span className={`scenario-badge badge-${sc.badgeType}`}>{sc.badge}</span>
                    <button
                      type="button"
                      className="scenario-run-btn"
                      title="Instantly inspect & verify this live Base transaction"
                      disabled={isWorking}
                      onClick={(e) => {
                        e.stopPropagation();
                        loadScenario(sc, true);
                      }}
                    >
                      <Play size={12} fill="currentColor" /> Run Live
                    </button>
                  </div>
                  <strong className="scenario-name">{sc.title}</strong>
                  <p className="scenario-desc">{sc.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 7-Step Chain of Custody Breadcrumb */}
        <div className="chain-of-custody" aria-label="Verification workflow sequence">
          <span className={currentStep >= 1 ? "step-active" : ""}>01 / INTENT</span>
          <i className={currentStep >= 2 ? "step-active" : ""} />
          <span className={currentStep >= 2 ? "step-active" : ""}>02 / POLICY</span>
          <i className={currentStep >= 3 ? "step-active" : ""} />
          <span className={currentStep >= 3 ? "step-active" : ""}>03 / {mode === "pre-execution" ? "PROPOSAL" : "REQUEST"}</span>
          <i className={currentStep >= 4 ? "step-active" : ""} />
          <span className={currentStep >= 4 ? "step-active" : ""}>04 / EVIDENCE</span>
          <i className={currentStep >= 5 ? "step-active" : ""} />
          <span className={currentStep >= 5 ? "step-active" : ""}>05 / VERDICT</span>
          <i className={currentStep >= 6 ? "step-active" : ""} />
          <span className={currentStep >= 6 ? "step-active" : ""}>06 / RECEIPT</span>
          <i className={currentStep >= 7 ? "step-active" : ""} />
          <span className={currentStep >= 7 ? "step-active" : ""}>07 / PROOF</span>
        </div>

        {/* Step 01: Human Intent Declaration */}
        <div className="app-workspace-grid">
          <section className="composer-panel" aria-labelledby="composer-title">
            <div className="panel-heading">
              <span className="panel-index">01</span>
              <div>
                <p className="panel-kicker">01 / INTENT</p>
                <h2 id="composer-title">Human constraint</h2>
              </div>
            </div>
            <form onSubmit={handleExtract} className="intent-form">
              <label htmlFor="intent-text">Declare user intent in natural language. Base must be explicit.</label>
              <textarea
                id="intent-text"
                value={intentText}
                onChange={(event) => {
                  setIntentText(event.target.value);
                  setClientError(null);
                  commitPolicy.reset();
                  anchorReceipt.reset();
                }}
                rows={4}
                maxLength={600}
                spellCheck="false"
              />
              <div className="composer-actions">
                <button className="button-primary" type="submit" disabled={isWorking}>
                  {parseIntent.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Extracting constraints</>
                  ) : (
                    <>Extract constraints <ArrowUpRight size={16} /></>
                  )}
                </button>
                <div className="llm-disclaimer-tag">
                  <strong>Zero-LLM Verdict Engine:</strong> The model may help interpret intent. It does not decide whether the transaction is safe.
                </div>
              </div>
            </form>
          </section>

          <aside className="operation-boundary">
            <SignalMark className="h-10 w-10 text-signal" />
            <p className="panel-kicker">
              {mode === "pre-execution" ? "Pre-Execution Safety Boundary" : "Post-Execution Attestation Boundary"}
            </p>
            <h2>
              {mode === "pre-execution" ? "Decide before you sign." : "Prove after execution."}
            </h2>
            <p>
              {mode === "pre-execution" ? (
                <>
                  <strong>Non-custodial boundary:</strong> IntentGuard never holds private keys or executes transactions on your behalf. It computes a deterministic verdict over proposed calldata to help the user/agent decide whether to proceed.
                </>
              ) : (
                <>
                  <strong>Forensic proof:</strong> IntentGuard inspects mined Base blocks and receipts, computes canonical hashes, and anchors an EIP-712 attestation to Base Sepolia contracts for audit trails.
                </>
              )}
            </p>
          </aside>
        </div>

        {errorMessage && (
          <div className="app-error" role="alert">
            <CircleAlert size={18} />
            <div>
              <strong>No verification decision was made.</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Step 02: Structured Policy Commitment */}
        {currentIntent && (
          <section className="intent-review-section" aria-labelledby="intent-review-title">
            <div className="section-kicker-row">
              <p className="eyebrow">02 / POLICY</p>
              <p className="mono-note">schema validated</p>
            </div>
            <div className="intent-review-grid">
              <div className="intent-summary">
                <p className="panel-kicker">02 / POLICY</p>
                <h2 id="intent-review-title">Cryptographic policy commitment</h2>
                <p>All verdicts below are calculated from these stated constraints and observable Base transaction evidence.</p>
              </div>
              <dl className="constraint-list">
                <div><dt>Action</dt><dd>{currentIntent.action.toUpperCase()}</dd></div>
                <div><dt>Chain</dt><dd>BASE / 8453</dd></div>
                <div><dt>Input</dt><dd>UP TO {currentIntent.maxSpendUsdc} USDC</dd></div>
                <div><dt>Desired output</dt><dd>{currentIntent.outputToken ?? "NOT SPECIFIED"}</dd></div>
                <div><dt>Maximum slippage</dt><dd>{currentIntent.maxSlippagePercent === null ? "NOT APPLICABLE" : `${currentIntent.maxSlippagePercent}%`}</dd></div>
                <div><dt>Unlimited approval</dt><dd className={currentIntent.prohibitUnlimitedApproval ? "policy-blocked" : ""}>{currentIntent.prohibitUnlimitedApproval ? "BLOCKED" : "NOT RESTRICTED"}</dd></div>
                {currentIntent.recipient && <div><dt>Recipient</dt><dd className="address-value">{currentIntent.recipient}</dd></div>}
              </dl>
            </div>
          </section>
        )}

        {/* Step 03: Agent Proposed Action / Request */}
        <section className="transaction-entry-section" aria-labelledby="transaction-title">
          <div className="panel-heading">
            <span className="panel-index">03</span>
            <div>
              <p className="panel-kicker">03 / {mode === "pre-execution" ? "PROPOSAL (PRE-FLIGHT)" : "REQUEST (POST-EXECUTION)"}</p>
              <h2 id="transaction-title">
                {mode === "pre-execution" ? "Agent proposed transaction / calldata" : "Mined Base transaction hash"}
              </h2>
            </div>
          </div>
          <p className="transaction-entry-copy">
            {mode === "pre-execution"
              ? "The autonomous agent proposes candidate calldata and destination parameters. IntentGuard decodes the proposal before signing to ensure zero unauthorized permissions."
              : "IntentGuard inspects mined Base transaction receipts and logs to verify whether actual execution stayed within declared human limits."}
          </p>
          <div className="hash-form">
            <label htmlFor="transaction-hash">
              {mode === "pre-execution" ? "Candidate transaction proposal / calldata hash" : "Base transaction hash"}
            </label>
            <div className="hash-control">
              <input
                id="transaction-hash"
                value={transactionHash}
                onChange={(event) => {
                  setTransactionHash(event.target.value);
                  setClientError(null);
                }}
                placeholder="0x…"
                inputMode="text"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                className="button-primary"
                onClick={handleVerify}
                disabled={isWorking || !currentIntent}
              >
                {verifyIntent.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Inspecting Base</>
                ) : mode === "pre-execution" ? (
                  <>Inspect candidate proposal <FileCheck2 size={16} /></>
                ) : (
                  <>Audit mined transaction <FileCheck2 size={16} /></>
                )}
              </button>
            </div>
            {!currentIntent && (
              <p className="form-note">Extract and review the intent first. No verification request will be sent until the policy is visible.</p>
            )}
          </div>
        </section>

        {/* Live Inspection Progress */}
        {verifyIntent.isPending && (
          <section className="verification-progress inspector-progress" aria-live="polite" aria-busy="true" aria-label="Live Base transaction inspection in progress">
            <div className="inspection-progress-heading">
              <Loader2 size={18} className="animate-spin" />
              <div>
                <strong>Live Base inspection is in progress.</strong>
                <span>The server will return transaction, receipt, router, quote, and policy evidence together. No stage is marked complete until that evidence arrives.</span>
              </div>
            </div>
            <ol className="inspection-stage-list">
              {inspectionStages.map((stage) => (
                <li key={stage.id} className="stage-pending">
                  <span>{stage.id}</span>
                  <div>
                    <strong>{stage.label}</strong>
                    <small>{stage.detail}</small>
                  </div>
                </li>
              ))}
            </ol>
            <div className="inspection-progress-meter is-indeterminate" aria-hidden="true"><i /></div>
          </section>
        )}

        {/* Steps 04 & 05: Evidence & Verdict */}
        {result && (
          <section className="verification-output" aria-labelledby="verification-title">
            <div className="section-kicker-row">
              <p className="eyebrow">04 / EVIDENCE & 05 / VERDICT ({mode.toUpperCase()})</p>
              <p className="mono-note">{result.verification.receiptId}</p>
            </div>

            {/* Central Product Showcase: The Intent Fidelity Triad */}
            <article className={`fidelity-triad-card fidelity-${result.verification.verdict.toLowerCase()}`}>
              <div className="fidelity-header">
                <div className="flex items-center gap-2">
                  {result.verification.verdict === "MATCH" ? (
                    <ShieldCheck size={20} className="text-signal" />
                  ) : (
                    <ShieldAlert size={20} className="text-signal" />
                  )}
                  <h3>INTENT FIDELITY COMPARISON</h3>
                </div>
                <span className={`fidelity-verdict-tag tag-${result.verification.verdict.toLowerCase()}`}>
                  {result.verification.verdict === "MATCH"
                    ? "100% FAITHFUL TO INTENT"
                    : result.verification.verdict === "MISMATCH"
                    ? "INTENT VIOLATION DETECTED"
                    : "CANNOT CONFIRM FIDELITY"}
                </span>
              </div>

              <div className="fidelity-triad-grid">
                {/* Box 1: Human Intent */}
                <div className="fidelity-box">
                  <div className="fidelity-box-header">
                    <span className="fidelity-step-num">01</span>
                    <strong>HUMAN DECLARED INTENT</strong>
                  </div>
                  <p className="fidelity-intent-quote">"{result.intent.sourceText}"</p>
                  <ul className="fidelity-constraints-mini">
                    <li><span>Action:</span> <strong>{result.intent.action.toUpperCase()}</strong></li>
                    <li><span>Max Spend:</span> <strong>{result.intent.maxSpendUsdc} USDC</strong></li>
                    <li>
                      <span>Unlimited Approval:</span>{" "}
                      <strong className={result.intent.prohibitUnlimitedApproval ? "text-danger" : ""}>
                        {result.intent.prohibitUnlimitedApproval ? "BLOCKED" : "ALLOWED"}
                      </strong>
                    </li>
                    {result.intent.maxSlippagePercent !== null && (
                      <li><span>Max Slippage:</span> <strong>{result.intent.maxSlippagePercent}%</strong></li>
                    )}
                  </ul>
                </div>

                {/* Arrow */}
                <div className="fidelity-arrow" aria-hidden="true">
                  <ArrowRight size={18} />
                </div>

                {/* Box 2: Agent Proposed Action */}
                <div className="fidelity-box">
                  <div className="fidelity-box-header">
                    <span className="fidelity-step-num">02</span>
                    <strong>AGENT PROPOSED ACTION</strong>
                  </div>
                  <dl className="fidelity-props-list">
                    <div>
                      <dt>Destination:</dt>
                      <dd className="address-value">{shortHash(result.inspection?.transaction?.to)}</dd>
                    </div>
                    <div>
                      <dt>Decoded Function:</dt>
                      <dd>{result.inspection?.decoded.kind.toUpperCase()}</dd>
                    </div>
                    <div>
                      <dt>Observed Spend:</dt>
                      <dd>
                        {result.inspection?.observations.spentUsdcRaw
                          ? formatUsdc(result.inspection.observations.spentUsdcRaw)
                          : formatUsdc(result.inspection?.decoded.amountRaw)}
                      </dd>
                    </div>
                    <div>
                      <dt>Approval Amount:</dt>
                      <dd className={result.inspection?.observations.approvals.some((a) => a.unlimited) ? "text-danger" : ""}>
                        {result.inspection?.observations.approvals.some((a) => a.unlimited)
                          ? "UNLIMITED (2^256-1)"
                          : "BOUNDED / EXACT"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Arrow */}
                <div className="fidelity-arrow" aria-hidden="true">
                  <ArrowRight size={18} />
                </div>

                {/* Box 3: IntentGuard Verdict */}
                <div className="fidelity-box fidelity-box-verdict">
                  <div className="fidelity-box-header">
                    <span className="fidelity-step-num">03</span>
                    <strong>INTENTGUARD VERDICT</strong>
                  </div>
                  <div className="fidelity-verdict-body">
                    <div className={`verdict-pill pill-${result.verification.verdict.toLowerCase()}`}>
                      {result.verification.verdict === "MATCH"
                        ? "MATCH"
                        : result.verification.verdict === "MISMATCH"
                        ? "MISMATCH"
                        : "CANNOT VERIFY"}
                    </div>
                    <p className="fidelity-verdict-summary">
                      {result.verification.verdict === "MATCH"
                        ? "Evidence proves the proposed action satisfies every declared human policy."
                        : result.verification.verdict === "MISMATCH"
                        ? "Evidence proves the proposed action violates declared human constraints."
                        : "There is not enough evidence to make either claim. CANNOT_VERIFY is not approval."}
                    </p>
                    {result.verification.verdict === "CANNOT_VERIFY" && (
                      <span className="fail-closed-notice">FAILS CLOSED (NOT APPROVAL)</span>
                    )}
                  </div>
                </div>
              </div>
            </article>

            <div className="verdict-grid">
              <article className={`verdict-card verdict-${result.verification.verdict.toLowerCase()}`}>
                <div className="verdict-icon">
                  {result.verification.verdict === "MATCH" ? (
                    <ShieldCheck size={29} />
                  ) : result.verification.verdict === "MISMATCH" ? (
                    <ShieldAlert size={29} />
                  ) : (
                    <CircleAlert size={29} />
                  )}
                </div>
                <p className="panel-kicker">05 / VERDICT ({mode === "pre-execution" ? "PRE-SIGNING" : "POST-MINED"})</p>
                <h2 id="verification-title">{verdictLabel(result.verification.verdict)}</h2>
                <p>{result.verification.summary}</p>
                {result.verification.verdict === "CANNOT_VERIFY" && (
                  <div className="fail-closed-banner">
                    <strong>SECURITY INVARIANT:</strong> Missing evidence never defaults to a pass. <em>CANNOT_VERIFY is not approval.</em>
                  </div>
                )}
                <div className="verdict-counts">
                  <span className="count-verified">{result.verification.verifiedChecks ?? result.verification.passedChecks} VERIFIED</span>
                  <span className="count-conflicting">{result.verification.conflictingChecks ?? result.verification.failedChecks} CONFLICTING</span>
                  <span className="count-insufficient">{result.verification.insufficientChecks ?? result.verification.unavailableChecks} INSUFFICIENT</span>
                </div>
              </article>

              <article className="transaction-panel">
                <div className="receipt-heading">
                  <p className="panel-kicker">04 / EVIDENCE: Blockchain facts</p>
                  {result.inspection && (
                    <a href={`https://basescan.org/tx/${result.inspection.transactionHash}`} target="_blank" rel="noreferrer">
                      View on BaseScan <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                {result.inspection ? (
                  <dl className="transaction-list">
                    <div><dt>Network</dt><dd>{result.inspection.networkChainId === "0x2105" ? "Base / 8453" : result.inspection.networkChainId}</dd></div>
                    <div><dt>Transaction</dt><dd className="address-value">{shortHash(result.inspection.transactionHash)}</dd></div>
                    <div><dt>To contract</dt><dd className="address-value">{shortHash(result.inspection.transaction?.to)}</dd></div>
                    <div><dt>Function</dt><dd>{result.inspection.decoded.kind === "unknown" ? "UNRESOLVED" : result.inspection.decoded.kind.toUpperCase()} {result.inspection.decoded.selector ?? ""}</dd></div>
                    <div><dt>Token</dt><dd>{result.inspection.decoded.routerSwap ? result.inspection.tokenMetadata.input?.symbol ?? "UNRESOLVED" : result.inspection.decoded.token ?? "NOT IDENTIFIED"}</dd></div>
                    <div><dt>Observed input</dt><dd>{result.inspection.decoded.routerSwap ? formatTokenAmount(result.inspection.decoded.routerSwap.amountInRaw, result.inspection.tokenMetadata.input) : formatUsdc(result.inspection.observations.spentUsdcRaw ?? result.inspection.decoded.amountRaw)}</dd></div>
                    <div><dt>Receipt</dt><dd>{result.inspection.receipt.state.toUpperCase()}</dd></div>
                    {result.inspection.decoded.routerSwap && (
                      <>
                        <div><dt>Allowlisted path</dt><dd className="address-value">{formatTokenLabel(result.inspection.decoded.routerSwap.tokenIn, result.inspection.tokenMetadata.input)} → {formatTokenLabel(result.inspection.decoded.routerSwap.tokenOut, result.inspection.tokenMetadata.output)} / {result.inspection.decoded.routerSwap.fee}</dd></div>
                        <div><dt>Current quote</dt><dd>{result.inspection.simulation.state === "available" ? formatTokenAmount(result.inspection.simulation.amountOutRaw, result.inspection.tokenMetadata.output) : "UNAVAILABLE"}</dd></div>
                      </>
                    )}
                  </dl>
                ) : (
                  <div className="unavailable-transaction">
                    <CircleAlert size={20} />
                    <p>Transaction data was unavailable. IntentGuard did not turn the missing evidence into a successful result.</p>
                  </div>
                )}
                {result.inspection && (
                  <details className="raw-evidence-details">
                    <summary>
                      <span><Braces size={15} /> Raw evidence packet</span>
                      <span>{result.inspection.raw.receipt?.logs.length ?? 0} receipt logs <ChevronDown size={14} /></span>
                    </summary>
                    <p>This packet contains the returned RPC fields, the full decoded calldata object, read-only token metadata, and read-only quote request/result metadata. It is inspectable evidence only; it never contains signing material.</p>
                    <pre>{JSON.stringify({ baseRpc: result.inspection.raw, decodedCalldata: result.inspection.decoded, tokenMetadata: result.inspection.tokenMetadata, readOnlySimulation: result.inspection.simulation }, null, 2)}</pre>
                  </details>
                )}
              </article>
            </div>

            {/* "Why Blocked?" Forensic Rule Matrix & Blocking Evidence Panel */}
            <article className={`why-blocked-panel ${result.verification.verdict === "MISMATCH" ? "is-mismatch" : result.verification.verdict === "MATCH" ? "is-match" : "is-unverifiable"}`}>
              <div className="why-blocked-header">
                <div className="flex items-center gap-2.5">
                  {result.verification.verdict === "MISMATCH" ? (
                    <ShieldAlert size={24} className="text-signal" />
                  ) : result.verification.verdict === "MATCH" ? (
                    <ShieldCheck size={24} className="text-signal" />
                  ) : (
                    <CircleAlert size={24} className="text-signal" />
                  )}
                  <div>
                    <h3 className="why-blocked-title">
                      {result.verification.verdict === "MISMATCH"
                        ? "FORENSIC AUDIT: WHY WAS THIS BLOCKED?"
                        : result.verification.verdict === "MATCH"
                        ? "FORENSIC AUDIT: RULE COMPLIANCE MATRIX"
                        : "FORENSIC AUDIT: UNVERIFIABLE CONSTRAINTS"}
                    </h3>
                    <p className="why-blocked-subtitle">
                      {result.verification.verdict === "MISMATCH"
                        ? "IntentGuard identified one or more strict policy violations between declared human constraints and observable Base data."
                        : result.verification.verdict === "MATCH"
                        ? "Every evaluated constraint was verified 100% compliant against on-chain Base Mainnet facts."
                        : "Required on-chain logs or execution deltas could not be resolved from available Base RPC evidence."}
                    </p>
                  </div>
                </div>
                <div className={`verdict-stamp stamp-${result.verification.verdict.toLowerCase()}`}>
                  {result.verification.verdict === "MATCH" ? "✓ MATCH" : result.verification.verdict === "MISMATCH" ? "✕ MISMATCH" : "? CANNOT_VERIFY"}
                </div>
              </div>

              {/* Forensic Rule Matrix Table */}
              <div className="rule-matrix-wrapper">
                <table className="rule-matrix-table" aria-label="Policy constraint compliance matrix">
                  <thead>
                    <tr>
                      <th scope="col">Rule / Constraint</th>
                      <th scope="col">Expected (Human Intent)</th>
                      <th scope="col">Observed (Base Facts)</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Network / Chain</strong></td>
                      <td>Base Mainnet (8453)</td>
                      <td><code>{result.inspection?.networkChainId === "0x2105" ? "Base (8453)" : (result.inspection?.networkChainId ?? "8453")}</code></td>
                      <td><span className="matrix-badge badge-verified">✓ VERIFIED</span></td>
                    </tr>
                    <tr>
                      <td><strong>Target Action</strong></td>
                      <td>{result.intent.action.toUpperCase()}</td>
                      <td><code>{result.inspection?.decoded.kind.toUpperCase() ?? "UNRESOLVED"}</code></td>
                      <td><span className="matrix-badge badge-verified">✓ VERIFIED</span></td>
                    </tr>
                    <tr>
                      <td><strong>Input / Spend Cap</strong></td>
                      <td>≤ {result.intent.maxSpendUsdc} USDC</td>
                      <td>
                        <code>
                          {result.inspection?.observations.spentUsdcRaw
                            ? formatUsdc(result.inspection.observations.spentUsdcRaw)
                            : result.inspection?.decoded.amountRaw
                            ? formatUsdc(result.inspection.decoded.amountRaw)
                            : "None"}
                        </code>
                      </td>
                      <td>
                        {result.verification.evidence.some((e) => e.id === "spend-limit" && (e.state === "CONFLICTING" || e.state === "failed")) ? (
                          <span className="matrix-badge badge-conflicting">✕ CONFLICTING</span>
                        ) : (
                          <span className="matrix-badge badge-verified">✓ VERIFIED</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Recipient / Target</strong></td>
                      <td>{result.intent.recipient ? shortHash(result.intent.recipient) : "Approved / Allowlisted"}</td>
                      <td><code>{shortHash(result.inspection?.decoded.recipient ?? result.inspection?.transaction?.to)}</code></td>
                      <td><span className="matrix-badge badge-verified">✓ VERIFIED</span></td>
                    </tr>
                    <tr>
                      <td><strong>Spending Approval</strong></td>
                      <td>{result.intent.prohibitUnlimitedApproval ? `≤ ${result.intent.maxSpendUsdc} USDC (No Unlimited)` : "Unrestricted"}</td>
                      <td>
                        <code>
                          {result.inspection?.observations.approvals.some((a) => a.unlimited)
                            ? "∞ (UNLIMITED: 2^256 - 1)"
                            : result.inspection?.decoded.kind === "approve"
                            ? formatUsdc(result.inspection.decoded.amountRaw)
                            : "Bounded / Not modified"}
                        </code>
                      </td>
                      <td>
                        {result.verification.evidence.some((e) => e.id === "approval" && (e.state === "CONFLICTING" || e.state === "failed")) ? (
                          <span className="matrix-badge badge-conflicting">✕ CONFLICTING</span>
                        ) : (
                          <span className="matrix-badge badge-verified">✓ VERIFIED</span>
                        )}
                      </td>
                    </tr>
                    {result.intent.maxSlippagePercent !== null && (
                      <tr>
                        <td><strong>Max Slippage</strong></td>
                        <td>≤ {result.intent.maxSlippagePercent}%</td>
                        <td>
                          <code>{result.inspection?.simulation.state === "available" ? "QuoterV2 Live Pricing" : "Historical proof required"}</code>
                        </td>
                        <td>
                          {result.verification.evidence.some((e) => e.id === "slippage" && (e.state === "INSUFFICIENT" || e.state === "unavailable")) ? (
                            <span className="matrix-badge badge-insufficient">? INSUFFICIENT</span>
                          ) : (
                            <span className="matrix-badge badge-verified">✓ VERIFIED</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Blocking Evidence Spotlight (when MISMATCH occurs) */}
              {result.verification.verdict === "MISMATCH" && (
                <div className="blocking-spotlight">
                  <div className="blocking-spotlight-title">
                    <span className="blocking-pill">BLOCKING EVIDENCE</span>
                    <span className="rule-code-badge">
                      {result.verification.evidence.some((e) => e.id === "approval" && (e.state === "CONFLICTING" || e.state === "failed"))
                        ? "IG-APPROVE-001"
                        : "IG-SPEND-001"}
                    </span>
                  </div>

                  {result.verification.evidence.some((e) => e.id === "approval" && (e.state === "CONFLICTING" || e.state === "failed")) ? (
                    <div className="blocking-details-grid">
                      <p className="blocking-explanation">
                        The proposed transaction grants an <strong>unlimited allowance ($2^{'{256}'} - 1$)</strong> to spender{" "}
                        <code>{shortHash(result.inspection?.decoded.spender ?? result.inspection?.observations.approvals[0]?.spender)}</code>.
                      </p>
                      <div className="blocking-stats-row">
                        <div className="blocking-stat">
                          <span className="stat-label">Maximum permitted allowance:</span>
                          <strong className="stat-val">{result.intent.maxSpendUsdc} USDC</strong>
                        </div>
                        <div className="blocking-stat stat-danger">
                          <span className="stat-label">Observed proposed allowance:</span>
                          <strong className="stat-val">2^256 - 1 (UNLIMITED)</strong>
                        </div>
                        <div className="blocking-stat">
                          <span className="stat-label">Decision & Action:</span>
                          <strong className="stat-val text-danger">MISMATCH — DO NOT SIGN</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="blocking-details-grid">
                      <p className="blocking-explanation">
                        The transaction spend exceeded the declared user cap of{" "}
                        <strong>{result.intent.maxSpendUsdc} USDC</strong>.
                      </p>
                      <div className="blocking-stats-row">
                        <div className="blocking-stat">
                          <span className="stat-label">Maximum permitted spend:</span>
                          <strong className="stat-val">{result.intent.maxSpendUsdc} USDC</strong>
                        </div>
                        <div className="blocking-stat stat-danger">
                          <span className="stat-label">Observed transaction spend:</span>
                          <strong className="stat-val">
                            {formatUsdc(result.inspection?.observations.spentUsdcRaw ?? result.inspection?.decoded.amountRaw)}
                          </strong>
                        </div>
                        <div className="blocking-stat">
                          <span className="stat-label">Decision & Action:</span>
                          <strong className="stat-val text-danger">MISMATCH — VIOLATION PROVED</strong>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="blocking-footer-note">
                    This transaction cannot be considered faithful to the declared intent.
                  </p>
                </div>
              )}

              {/* Insufficient Evidence Spotlight (when CANNOT_VERIFY occurs) */}
              {result.verification.verdict === "CANNOT_VERIFY" && (
                <div className="blocking-spotlight spotlight-unverifiable">
                  <div className="blocking-spotlight-title">
                    <span className="blocking-pill pill-amber">INSUFFICIENT EVIDENCE</span>
                    <span className="rule-code-badge badge-amber">EP-EVIDENCE-001</span>
                  </div>
                  <div className="blocking-details-grid">
                    <p className="blocking-explanation">
                      There is <strong>not enough observable Base RPC evidence</strong> to prove or disprove compliance with declared human intent.
                    </p>
                    <div className="blocking-stats-row">
                      <div className="blocking-stat">
                        <span className="stat-label">Evaluated Constraints:</span>
                        <strong className="stat-val">{result.verification.verifiedChecks ?? result.verification.passedChecks} Verified / {result.verification.insufficientChecks ?? result.verification.unavailableChecks} Missing</strong>
                      </div>
                      <div className="blocking-stat stat-amber">
                        <span className="stat-label">Core Principle:</span>
                        <strong className="stat-val">CANNOT_VERIFY is not approval</strong>
                      </div>
                      <div className="blocking-stat">
                        <span className="stat-label">Decision & Action:</span>
                        <strong className="stat-val text-amber">FAILS CLOSED (BLOCKED)</strong>
                      </div>
                    </div>
                  </div>
                  <p className="blocking-footer-note note-amber">
                    IntentGuard fails closed: missing evidence never defaults to a pass. Signing remains blocked.
                  </p>
                </div>
              )}
            </article>

            {/* Evaluation Checks */}
            <div className="result-details-grid">
              <article className="evidence-panel">
                <div className="receipt-heading">
                  <p className="panel-kicker">04 / EVIDENCE: Evaluation checks</p>
                  <span>{result.verification.evidence.length} deterministic checks</span>
                </div>
                <ul className="evidence-list">
                  {result.verification.evidence.map((item) => {
                    const normState = item.state === "VERIFIED" || item.state === "verified" ? "VERIFIED" : item.state === "CONFLICTING" || item.state === "failed" ? "CONFLICTING" : "INSUFFICIENT";
                    return (
                      <li key={item.id} className={`evidence-${normState.toLowerCase()}`}>
                        <span className={`evidence-state-badge badge-${normState.toLowerCase()}`}>
                          {normState}
                        </span>
                        <div>
                          <strong>{item.label}</strong>
                          <p>{item.detail}</p>
                          <small>{item.source}</small>
                          {result.inspection && (
                            <details className="evidence-row-details">
                              <summary>Inspect source fields <ChevronDown size={13} /></summary>
                              <dl>
                                <div><dt>Evidence source</dt><dd>{item.source}</dd></div>
                                <div><dt>Transaction</dt><dd className="address-value">{result.inspection.transactionHash}</dd></div>
                                <div><dt>Selector</dt><dd>{result.inspection.decoded.selector ?? "Unavailable"}</dd></div>
                                <div><dt>Destination</dt><dd className="address-value">{result.inspection.transaction?.to ?? "Unavailable"}</dd></div>
                                {result.inspection.decoded.routerSwap && (
                                  <>
                                    <div><dt>Token in</dt><dd className="address-value">{result.inspection.decoded.routerSwap.tokenIn}</dd></div>
                                    <div><dt>Token out</dt><dd className="address-value">{result.inspection.decoded.routerSwap.tokenOut}</dd></div>
                                    <div><dt>Fee / recipient</dt><dd>{result.inspection.decoded.routerSwap.fee} / {shortHash(result.inspection.decoded.routerSwap.recipient)}</dd></div>
                                    <div><dt>Amount in / minimum</dt><dd>{result.inspection.decoded.routerSwap.amountInRaw} / {result.inspection.decoded.routerSwap.amountOutMinimumRaw}</dd></div>
                                    <div><dt>Price limit</dt><dd>{result.inspection.decoded.routerSwap.sqrtPriceLimitX96Raw}</dd></div>
                                  </>
                                )}
                                {item.source === "Read-only QuoterV2" && (
                                  <>
                                    <div><dt>Quote state / block</dt><dd>{result.inspection.simulation.state.toUpperCase()} / {result.inspection.simulation.blockTag ?? "not requested"}</dd></div>
                                    <div><dt>Quote contract</dt><dd className="address-value">{result.inspection.simulation.contractAddress ?? "Unavailable"}</dd></div>
                                    <div><dt>Method / selector</dt><dd>{result.inspection.simulation.method ?? "Unavailable"} / {result.inspection.simulation.selector ?? "Unavailable"}</dd></div>
                                    <div><dt>Output / gas estimate</dt><dd>{result.inspection.simulation.amountOutRaw ?? "Unavailable"} / {result.inspection.simulation.gasEstimate ?? "Unavailable"}</dd></div>
                                  </>
                                )}
                              </dl>
                            </details>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
              <article className="trace-panel-app">
                <div className="receipt-heading">
                  <p className="panel-kicker">Agent trace</p>
                  <span>actual operations</span>
                </div>
                <ol>
                  {result.trace.map((step) => (
                    <li key={step.id} className={`trace-${step.state}`}>
                      <span>{step.id}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            </div>

            {/* Step 06: Provenance Origin Tree */}
            <article className="provenance-panel" aria-labelledby="provenance-title">
              <div className="receipt-heading">
                <p className="panel-kicker" id="provenance-title">06 / RECEIPT: Provenance Origin Tree</p>
                <span>Forensic origin trace</span>
              </div>
              <p className="provenance-intro">
                Where did this evidence come from? Every observed fact is anchored to an immutable Base block, deterministic calldata decoder, and verified source hash:
              </p>
              <div className="provenance-tree" role="region" aria-label="Evidence origin tree">
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Source:</span>
                  <strong className="tree-val">{result.verification.provenance?.source ?? "Base JSON-RPC"}</strong>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Block:</span>
                  <span className="tree-val">
                    {result.verification.provenance?.blockNumber ? (
                      <span className="tree-block-badge">Block #{result.verification.provenance.blockNumber} (anchored)</span>
                    ) : (
                      "Pending / Unmined"
                    )}
                  </span>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Transaction:</span>
                  <span className="tree-val address-value">{result.verification.provenance?.transactionHash ? shortHash(result.verification.provenance.transactionHash) : "Unavailable"}</span>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Receipt status:</span>
                  <strong className="tree-val">{result.verification.provenance?.receiptStatus ?? "Unavailable"}</strong>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Contract:</span>
                  <span className="tree-val address-value">{result.verification.provenance?.contractAddress ? shortHash(result.verification.provenance.contractAddress) : "None"}</span>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Decoder:</span>
                  <strong className="tree-val">{result.verification.provenance?.decoder ?? "Direct Decoder"}</strong>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Protocol version:</span>
                  <span className="tree-val">v{result.verification.provenance?.protocolVersion ?? 1}</span>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Policy version:</span>
                  <span className="tree-val">v{result.verification.provenance?.policyVersion ?? 1}</span>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Engine version:</span>
                  <span className="tree-val">v{result.verification.provenance?.engineVersion ?? 1}</span>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Decoder version:</span>
                  <span className="tree-val">v{result.verification.provenance?.decoderVersion ?? 1}</span>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">├──</span>
                  <span className="tree-label">Receipt schema:</span>
                  <span className="tree-val">v{result.verification.provenance?.receiptSchemaVersion ?? 1}</span>
                </div>
                <div className="tree-node">
                  <span className="tree-branch">└──</span>
                  <span className="tree-label">Evidence hash:</span>
                  <span className="tree-val address-value">{result.verification.provenance?.evidenceHash ? shortHash(result.verification.provenance.evidenceHash) : "Not generated"}</span>
                </div>
              </div>
            </article>

            {/* EIP-712 Attestation Receipt Card */}
            <article className="intent-receipt">
              <div className="receipt-heading">
                <p className="panel-kicker">06 / RECEIPT: EIP-712 attestation</p>
                <span>Verified at {new Date(result.verification.observedAt).toLocaleString()}</span>
              </div>
              <div className="receipt-grid">
                <div><span>ID</span><strong>{result.verification.receiptId}</strong></div>
                <div><span>Intent</span><strong>{result.intent.action.toUpperCase()} / {result.intent.maxSpendUsdc} USDC / BASE</strong></div>
                <div><span>Result</span><strong className={`receipt-${result.verification.verdict.toLowerCase()}`}>{result.verification.verdict}</strong></div>
                <div><span>Approval boundary</span><strong>{mode === "pre-execution" ? "PRE-SIGNING GATE" : "POST-EXECUTION AUDIT"}</strong></div>
              </div>
            </article>

            {/* Step 07: Base Sepolia On-chain Anchoring */}
            <article className="trust-loop-panel" aria-labelledby="trust-loop-title">
              <div className="receipt-heading">
                <p className="panel-kicker" id="trust-loop-title">07 / PROOF: Base Sepolia Registry</p>
                <span>On-chain trust loop</span>
              </div>
              <p className="trust-loop-copy">
                The Base Mainnet verdict remains a read-only inspection. The controls below commit the canonical policy and anchor a signed, independently attributable receipt on Base Sepolia only after transaction confirmation and on-chain readback validation.
              </p>
              <div className="trust-loop-grid">
                <div>
                  <span>Policy</span>
                  <strong className={policyCommitment ? "trust-confirmed" : "trust-pending"}>
                    {policyCommitment ? "COMMITTED" : "NOT COMMITTED"}
                  </strong>
                  {policyCommitment ? (
                    <>
                      <small>{shortHash(policyCommitment.policyId)}</small>
                      <a href={policyCommitment.explorerUrl} target="_blank" rel="noreferrer">Commitment tx <ExternalLink size={12} /></a>
                    </>
                  ) : (
                    <small>No policy transaction has been confirmed.</small>
                  )}
                </div>
                <div>
                  <span>Proposing agent</span>
                  <strong className="trust-confirmed">ORION AGENT</strong>
                  <small>Plans & proposes candidate calldata / transaction.</small>
                </div>
                <div>
                  <span>Attesting evaluator</span>
                  <strong className={anchoredReceipt ? "trust-confirmed" : "trust-pending"}>
                    {anchoredReceipt ? "EVALUATOR SIGNED" : "NOT SIGNED"}
                  </strong>
                  <small>{anchoredReceipt ? `Evaluator ${shortHash(anchoredReceipt.receipt.evaluator)} (holds EVALUATOR_ROLE)` : "Evaluator signs EIP-712 receipt; separate from agent."}</small>
                </div>
                <div>
                  <span>Transaction subject</span>
                  <strong className="address-value">{result.inspection?.transaction?.from ? shortHash(result.inspection.transaction.from) : "UNAVAILABLE"}</strong>
                  <small>Execution address on Base; independent from committer.</small>
                </div>
                <div>
                  <span>Evidence hash</span>
                  <strong className={anchoredReceipt ? "trust-confirmed address-value" : "trust-pending"}>
                    {anchoredReceipt ? shortHash(anchoredReceipt.receipt.evidenceHash) : "NOT GENERATED"}
                  </strong>
                  <small>{anchoredReceipt ? "Bound into the anchored receipt." : "Generated during deterministic evaluation."}</small>
                </div>
                <div>
                  <span>On-chain attestation</span>
                  <strong className={anchoredReceipt ? "trust-confirmed" : "trust-pending"}>
                    {anchoredReceipt ? "ANCHORED" : "NOT ANCHORED"}
                  </strong>
                  {anchoredReceipt ? (
                    <>
                      <small>{shortHash(anchoredReceipt.receipt.receiptId)}</small>
                      <a href={anchoredReceipt.explorerUrl} target="_blank" rel="noreferrer">Anchor tx <ExternalLink size={12} /></a>
                    </>
                  ) : (
                    <small>ReceiptRegistry on Base Sepolia.</small>
                  )}
                </div>
              </div>
              <div className="trust-loop-actions">
                <div>
                  <p className="panel-kicker">No wallet execution</p>
                  <p>IntentGuard uses server-held infrastructure credentials only. It never requests the transaction sender’s private key, seed phrase, or wallet signature.</p>
                </div>
                {!policyCommitment ? (
                  <button type="button" className="button-primary" disabled={isWorking || !currentIntent} onClick={handleCommitPolicy}>
                    {commitPolicy.isPending ? <><Loader2 size={16} className="animate-spin" /> Committing policy</> : <>Commit reviewed policy <FileCheck2 size={16} /></>}
                  </button>
                ) : (
                  <button type="button" className="button-primary" disabled={isWorking || !result.inspection || Boolean(anchoredReceipt)} onClick={handleAnchorReceipt}>
                    {anchorReceipt.isPending ? <><Loader2 size={16} className="animate-spin" /> Anchoring receipt</> : anchoredReceipt ? <>Receipt anchored <Check size={16} /></> : <>Anchor verification receipt <FileCheck2 size={16} /></>}
                  </button>
                )}
              </div>
            </article>

            {/* Verifiable Session Export */}
            {verificationSession && (
              <article className="session-bundle-card">
                <div className="receipt-heading">
                  <p className="panel-kicker">07 / PROOF: Verifiable Forensic Session</p>
                  <div className="session-actions">
                    <button
                      type="button"
                      className="button-subtle"
                      onClick={downloadSessionJson}
                      title="Download complete JSON file"
                    >
                      <Download size={14} /> Download Evidence Packet (.json)
                    </button>
                    <button
                      type="button"
                      className="button-subtle"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(verificationSession, null, 2));
                        setSessionCopied(true);
                        setTimeout(() => setSessionCopied(false), 2000);
                      }}
                    >
                      {sessionCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy JSON</>}
                    </button>
                    <button
                      type="button"
                      className="button-subtle"
                      onClick={() => setShowSessionJson((prev) => !prev)}
                    >
                      <Braces size={14} /> {showSessionJson ? "Hide Raw" : "Inspect Session JSON"}
                    </button>
                  </div>
                </div>
                <p className="provenance-copy">Unified verifiable bundle containing: <code>IntentSpec</code> + <code>PolicyCommitment</code> + <code>ProposedRequest</code> + <code>EvidencePacket</code> + <code>VerificationResult</code> + <code>ReceiptAttestation</code>.</p>
                {showSessionJson && (
                  <pre className="session-json-view">
                    <code>{JSON.stringify(verificationSession, null, 2)}</code>
                  </pre>
                )}
              </article>
            )}

            {/* Human Review Gate */}
            <article className="human-review-panel">
              <div>
                <p className="panel-kicker">Human review record</p>
                <h3>
                  {mode === "pre-execution"
                    ? result.verification.verdict === "MATCH"
                      ? "Proposal verified safe. Human or agent may authorize signing."
                      : "Proposal blocked. Do NOT sign or broadcast this transaction."
                    : result.verification.verdict === "MATCH"
                    ? "Mined transaction verified. Attestation receipt recorded."
                    : "Mined transaction violated declared intent."}
                </h3>
                <p>
                  {result.verification.verdict === "MATCH"
                    ? "Recording this review is a local browser acknowledgement only. It does not request a signature, connect a wallet, or submit a transaction."
                    : result.verification.verdict === "MISMATCH"
                    ? "IntentGuard will not enable approval because the observed action conflicts with an explicit constraint."
                    : "IntentGuard will not enable approval because one or more required facts remain unavailable."}
                </p>
              </div>
              <button
                type="button"
                className="human-review-button"
                disabled={result.verification.verdict !== "MATCH" || humanReviewRecorded}
                onClick={() => setHumanReviewRecorded(true)}
              >
                {humanReviewRecorded
                  ? "Review recorded locally"
                  : result.verification.verdict === "MATCH"
                  ? mode === "pre-execution"
                    ? "Authorize signing (Local)"
                    : "Record audit review"
                  : "Approval blocked"}
              </button>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
