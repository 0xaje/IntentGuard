// Forensic Signal style reminder: show the evidence trail before the visual verdict; never imply a successful chain action or wallet approval that did not occur.
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowUpRight, Braces, Check, ChevronDown, CircleAlert, Copy, Download, ExternalLink, FileCheck2, Loader2, ScanLine, ShieldAlert, ShieldCheck } from "lucide-react";
import SignalMark from "@/components/SignalMark";
import { trpc } from "@/lib/trpc";
import type { VerificationSession } from "@shared/intentguard";

const examples = [
  {
    label: "1% swap guardrail",
    text: "Swap $100 USDC for ETH on Base. Maximum slippage 1%. Don't allow unlimited approvals.",
  },
  {
    label: "Tighter execution rule",
    text: "Swap 50 USDC for ETH on Base. Maximum slippage 0.5%. Don't allow unlimited approvals.",
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
  const [intentText, setIntentText] = useState(examples[0].text);
  const [transactionHash, setTransactionHash] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [humanReviewRecorded, setHumanReviewRecorded] = useState(false);
  const [showSessionJson, setShowSessionJson] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);

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

  function handleExtract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);
    setHumanReviewRecorded(false);
    verifyIntent.reset();
    commitPolicy.reset();
    anchorReceipt.reset();
    parseIntent.mutate({ text: intentText });
  }

  function handleVerify() {
    const normalizedHash = transactionHash.trim();
    if (!currentIntent) {
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
              <span className="context-label">Agent-Compatible Transaction Verification</span>
            </div>
          </div>
          <div className="app-status-bar">
            <div className="status-indicator">
              <span className={`status-dot ${baseHealth.data?.status === "reachable" ? "status-online" : "status-offline"}`} />
              <span className="status-text">{baseHealth.data?.status === "reachable" ? "Base RPC connected" : baseHealth.data?.status === "wrong-network" ? "Base RPC (Network mismatch)" : "Base RPC offline"}</span>
            </div>
            <Link href="/" className="back-link"><ArrowLeft size={14} /> Back to Overview</Link>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-intro">
          <div>
            <p className="eyebrow">Deterministic Trust Lifecycle</p>
            <h1>Prove that an AI agent did what the human actually asked.</h1>
            <p className="app-intro-copy">
              A deterministic trust layer for AI agents that converts human intent into enforceable constraints, independently evaluates proposed blockchain actions, and produces cryptographically verifiable receipts.
            </p>
          </div>
          <div className="app-meta-box">
            <div className="meta-row">
              <span className="meta-label">Protocol</span>
              <span className="meta-val">v1 (Base / 8453)</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Registry</span>
              <span className="meta-val">Base Sepolia (84532)</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Model</span>
              <span className="meta-val">Zero Custody • Fail-Closed</span>
            </div>
          </div>
        </div>

        <div className="chain-of-custody" aria-label="Verification workflow sequence">
          <span>01 / INTENT</span><i /><span>02 / POLICY</span><i /><span>03 / REQUEST</span><i /><span>04 / EVIDENCE</span><i /><span>05 / VERDICT</span><i /><span>06 / RECEIPT</span><i /><span>07 / PROOF</span>
        </div>

        <div className="app-workspace-grid">
          <section className="composer-panel" aria-labelledby="composer-title">
            <div className="panel-heading">
              <span className="panel-index">01</span>
              <div><p className="panel-kicker">01 / INTENT</p><h2 id="composer-title">Human constraint</h2></div>
            </div>
            <form onSubmit={handleExtract} className="intent-form">
              <label htmlFor="intent-text">Declare user intent in natural language. Base must be explicit.</label>
              <textarea id="intent-text" value={intentText} onChange={(event) => { setIntentText(event.target.value); setClientError(null); commitPolicy.reset(); anchorReceipt.reset(); }} rows={7} maxLength={600} spellCheck="false" />
              <div className="example-row" aria-label="Supported example intents">
                {examples.map((example) => (
                  <button key={example.label} type="button" className="example-chip" onClick={() => { setIntentText(example.text); setClientError(null); parseIntent.reset(); verifyIntent.reset(); commitPolicy.reset(); anchorReceipt.reset(); }}>
                    {example.label}
                  </button>
                ))}
              </div>
              <div className="composer-actions">
                <button className="button-primary" type="submit" disabled={isWorking}>
                  {parseIntent.isPending ? <><Loader2 size={16} className="animate-spin" /> Extracting constraints</> : <>Extract constraints <ArrowUpRight size={16} /></>}
                </button>
                <p>Supported now: Base USDC→ETH swaps and Base USDC transfers to a real EVM address.</p>
              </div>
            </form>
          </section>

          <aside className="operation-boundary">
            <SignalMark className="h-10 w-10 text-signal" />
            <p className="panel-kicker">Deterministic Trust Guardrail</p>
            <h2>Agent proposes; IntentGuard evaluates.</h2>
            <p><strong>Non-custodial boundary:</strong> The agent never holds user funds or private keys. The agent simply proposes candidate calldata and transactions. <br /><br /><strong>Independent attestation:</strong> IntentGuard deterministically verifies observed facts against the human policy, signs an EIP-712 trust receipt, and anchors it to Base Sepolia.</p>
          </aside>
        </div>

        {errorMessage && <div className="app-error" role="alert"><CircleAlert size={18} /><div><strong>No verification decision was made.</strong><span>{errorMessage}</span></div></div>}

        {currentIntent && (
          <section className="intent-review-section" aria-labelledby="intent-review-title">
            <div className="section-kicker-row"><p className="eyebrow">02 / POLICY</p><p className="mono-note">schema validated</p></div>
            <div className="intent-review-grid">
              <div className="intent-summary">
                <p className="panel-kicker">02 / POLICY</p>
                <h2 id="intent-review-title">Cryptographic policy commitment</h2>
                <p>All verdicts below are calculated from these stated constraints and the observable Base transaction evidence.</p>
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

        <section className="transaction-entry-section" aria-labelledby="transaction-title">
          <div className="panel-heading"><span className="panel-index">03</span><div><p className="panel-kicker">03 / REQUEST</p><h2 id="transaction-title">Agent proposal (Orion / AI Agent)</h2></div></div>
          <p className="transaction-entry-copy">The autonomous agent does not evaluate its own safety or hold custody—it simply <strong>produces a proposed action</strong>. IntentGuard independently checks whether this real Base transaction or calldata matches the human instruction before or after execution.</p>
          <div className="hash-form">
            <label htmlFor="transaction-hash">Base transaction hash / proposed calldata</label>
            <div className="hash-control"><input id="transaction-hash" value={transactionHash} onChange={(event) => { setTransactionHash(event.target.value); setClientError(null); }} placeholder="0x…" inputMode="text" autoComplete="off" spellCheck="false" /><button type="button" className="button-primary" onClick={handleVerify} disabled={isWorking || !currentIntent}>{verifyIntent.isPending ? <><Loader2 size={16} className="animate-spin" /> Inspecting Base</> : <>Verify agent action <FileCheck2 size={16} /></>}</button></div>
            {!currentIntent && <p className="form-note">Extract and review the intent first. No verification request will be sent until the policy is visible.</p>}
          </div>
        </section>

        {verifyIntent.isPending && <section className="verification-progress inspector-progress" aria-live="polite" aria-busy="true" aria-label="Live Base transaction inspection in progress"><div className="inspection-progress-heading"><Loader2 size={18} className="animate-spin" /><div><strong>Live Base inspection is in progress.</strong><span>The server will return transaction, receipt, router, quote, and policy evidence together. No stage is marked complete until that evidence arrives.</span></div></div><ol className="inspection-stage-list">{inspectionStages.map((stage) => <li key={stage.id} className="stage-pending"><span>{stage.id}</span><div><strong>{stage.label}</strong><small>{stage.detail}</small></div></li>)}</ol><div className="inspection-progress-meter is-indeterminate" aria-hidden="true"><i /></div></section>}

        {result && (
          <section className="verification-output" aria-labelledby="verification-title">
            <div className="section-kicker-row"><p className="eyebrow">04 / EVIDENCE & 05 / VERDICT</p><p className="mono-note">{result.verification.receiptId}</p></div>
            <div className="verdict-grid">
              <article className={`verdict-card verdict-${result.verification.verdict.toLowerCase()}`}>
                <div className="verdict-icon">{result.verification.verdict === "MATCH" ? <ShieldCheck size={29} /> : <ShieldAlert size={29} />}</div>
                <p className="panel-kicker">05 / VERDICT</p>
                <h2 id="verification-title">{verdictLabel(result.verification.verdict)}</h2>
                <p>{result.verification.summary}</p>
                <div className="verdict-counts">
                  <span className="count-verified">{result.verification.verifiedChecks ?? result.verification.passedChecks} VERIFIED</span>
                  <span className="count-conflicting">{result.verification.conflictingChecks ?? result.verification.failedChecks} CONFLICTING</span>
                  <span className="count-insufficient">{result.verification.insufficientChecks ?? result.verification.unavailableChecks} INSUFFICIENT</span>
                </div>
              </article>

              <article className="transaction-panel">
                <div className="receipt-heading"><p className="panel-kicker">04 / EVIDENCE: Blockchain facts</p>{result.inspection && <a href={`https://basescan.org/tx/${result.inspection.transactionHash}`} target="_blank" rel="noreferrer">View on BaseScan <ExternalLink size={13} /></a>}</div>
                {result.inspection ? <dl className="transaction-list">
                  <div><dt>Network</dt><dd>{result.inspection.networkChainId === "0x2105" ? "Base / 8453" : result.inspection.networkChainId}</dd></div>
                  <div><dt>Transaction</dt><dd className="address-value">{shortHash(result.inspection.transactionHash)}</dd></div>
                  <div><dt>To contract</dt><dd className="address-value">{shortHash(result.inspection.transaction?.to)}</dd></div>
                  <div><dt>Function</dt><dd>{result.inspection.decoded.kind === "unknown" ? "UNRESOLVED" : result.inspection.decoded.kind.toUpperCase()} {result.inspection.decoded.selector ?? ""}</dd></div>
                  <div><dt>Token</dt><dd>{result.inspection.decoded.routerSwap ? result.inspection.tokenMetadata.input?.symbol ?? "UNRESOLVED" : result.inspection.decoded.token ?? "NOT IDENTIFIED"}</dd></div>
                  <div><dt>Observed input</dt><dd>{result.inspection.decoded.routerSwap ? formatTokenAmount(result.inspection.decoded.routerSwap.amountInRaw, result.inspection.tokenMetadata.input) : formatUsdc(result.inspection.observations.spentUsdcRaw ?? result.inspection.decoded.amountRaw)}</dd></div>
                  <div><dt>Receipt</dt><dd>{result.inspection.receipt.state.toUpperCase()}</dd></div>
                  {result.inspection.decoded.routerSwap && <><div><dt>Allowlisted path</dt><dd className="address-value">{formatTokenLabel(result.inspection.decoded.routerSwap.tokenIn, result.inspection.tokenMetadata.input)} → {formatTokenLabel(result.inspection.decoded.routerSwap.tokenOut, result.inspection.tokenMetadata.output)} / {result.inspection.decoded.routerSwap.fee}</dd></div><div><dt>Current quote</dt><dd>{result.inspection.simulation.state === "available" ? formatTokenAmount(result.inspection.simulation.amountOutRaw, result.inspection.tokenMetadata.output) : "UNAVAILABLE"}</dd></div></>}
                </dl> : <div className="unavailable-transaction"><CircleAlert size={20} /><p>Transaction data was unavailable. IntentGuard did not turn the missing evidence into a successful result.</p></div>}
                {result.inspection && <details className="raw-evidence-details"><summary><span><Braces size={15} /> Raw evidence packet</span><span>{result.inspection.raw.receipt?.logs.length ?? 0} receipt logs <ChevronDown size={14} /></span></summary><p>This packet contains the returned RPC fields, the full decoded calldata object, read-only token metadata, and read-only quote request/result metadata. It is inspectable evidence only; it never contains signing material.</p><pre>{JSON.stringify({ baseRpc: result.inspection.raw, decodedCalldata: result.inspection.decoded, tokenMetadata: result.inspection.tokenMetadata, readOnlySimulation: result.inspection.simulation }, null, 2)}</pre></details>}
              </article>
            </div>

            {/* Why Blocked / Intent Violation Breakdown */}
            {result.verification.verdict === "MISMATCH" && (
              <article className="violation-breakdown-card">
                <div className="violation-header">
                  <CircleAlert size={22} style={{ color: "#c84e31", flexShrink: 0 }} />
                  <div>
                    <h4>INTENT VIOLATION DETECTED</h4>
                    <p>IntentGuard blocked approval because the observed transaction directly contradicts declared policy limits.</p>
                  </div>
                </div>
                <div className="violation-grid">
                  {result.verification.evidence
                    .filter((item) => item.state === "CONFLICTING" || item.state === "failed")
                    .map((item) => (
                      <div key={item.id} className="violation-item">
                        <div className="violation-row">
                          <span className="violation-label">User policy:</span>
                          <strong>{item.id === "approval" ? "No unlimited approvals (prohibitUnlimitedApproval = true)" : item.id === "spend-limit" ? `Spend cap ${result.intent.maxSpendUsdc} USDC` : item.id === "chain" ? "Network must be Base Mainnet (8453)" : "Explicit declared human constraint"}</strong>
                        </div>
                        <div className="violation-row">
                          <span className="violation-label">Observed on Base:</span>
                          <span className="violation-val">{item.detail}</span>
                        </div>
                        <div className="violation-row">
                          <span className="violation-label">Deterministic rule:</span>
                          <code>{item.id === "approval" ? "APPROVAL_AMOUNT <= MAX_EXACT_SPEND" : item.id === "spend-limit" ? "OBSERVED_SPEND <= MAX_SPEND_USDC" : item.id === "chain" ? "CHAIN_ID == 8453" : "OBSERVED_FACTS == INTENT_SPEC"}</code>
                        </div>
                        <div className="violation-row">
                          <span className="violation-label">Evaluation result:</span>
                          <strong className="badge-conflicting">CONFLICTING → FAILED</strong>
                        </div>
                      </div>
                    ))}
                </div>
              </article>
            )}

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
              <article className="trace-panel-app"><div className="receipt-heading"><p className="panel-kicker">Agent trace</p><span>actual operations</span></div><ol>{result.trace.map((step) => <li key={step.id} className={`trace-${step.state}`}><span>{step.id}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div></li>)}</ol></article>
            </div>

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

            <article className="intent-receipt"><div className="receipt-heading"><p className="panel-kicker">06 / RECEIPT: EIP-712 attestation</p><span>Verified at {new Date(result.verification.observedAt).toLocaleString()}</span></div><div className="receipt-grid"><div><span>ID</span><strong>{result.verification.receiptId}</strong></div><div><span>Intent</span><strong>{result.intent.action.toUpperCase()} / {result.intent.maxSpendUsdc} USDC / BASE</strong></div><div><span>Result</span><strong className={`receipt-${result.verification.verdict.toLowerCase()}`}>{result.verification.verdict}</strong></div><div><span>Approval boundary</span><strong>NO SIGNATURE REQUESTED</strong></div></div></article>

            <article className="trust-loop-panel" aria-labelledby="trust-loop-title">
              <div className="receipt-heading"><p className="panel-kicker" id="trust-loop-title">07 / PROOF: Base Sepolia Registry</p><span>On-chain trust loop</span></div>
              <p className="trust-loop-copy">The Base Mainnet verdict remains a read-only inspection. The controls below commit the canonical policy and anchor a signed, independently attributable receipt on Base Sepolia only after transaction confirmation and on-chain readback validation.</p>
              <div className="trust-loop-grid">
                <div><span>Policy</span><strong className={policyCommitment ? "trust-confirmed" : "trust-pending"}>{policyCommitment ? "COMMITTED" : "NOT COMMITTED"}</strong>{policyCommitment ? <><small>{shortHash(policyCommitment.policyId)}</small><a href={policyCommitment.explorerUrl} target="_blank" rel="noreferrer">Commitment tx <ExternalLink size={12} /></a></> : <small>No policy transaction has been confirmed.</small>}</div>
                <div><span>Proposing agent</span><strong className="trust-confirmed">ORION AGENT</strong><small>Plans & proposes candidate calldata / transaction.</small></div>
                <div><span>Attesting evaluator</span><strong className={anchoredReceipt ? "trust-confirmed" : "trust-pending"}>{anchoredReceipt ? "EVALUATOR SIGNED" : "NOT SIGNED"}</strong><small>{anchoredReceipt ? `Evaluator ${shortHash(anchoredReceipt.receipt.evaluator)} (holds EVALUATOR_ROLE)` : "Evaluator signs EIP-712 receipt; separate from agent."}</small></div>
                <div><span>Transaction subject</span><strong className="address-value">{result.inspection?.transaction?.from ? shortHash(result.inspection.transaction.from) : "UNAVAILABLE"}</strong><small>Execution address on Base; independent from committer.</small></div>
                <div><span>Evidence hash</span><strong className={anchoredReceipt ? "trust-confirmed address-value" : "trust-pending"}>{anchoredReceipt ? shortHash(anchoredReceipt.receipt.evidenceHash) : "NOT GENERATED"}</strong><small>{anchoredReceipt ? "Bound into the anchored receipt." : "Generated during deterministic evaluation."}</small></div>
                <div><span>On-chain attestation</span><strong className={anchoredReceipt ? "trust-confirmed" : "trust-pending"}>{anchoredReceipt ? "ANCHORED" : "NOT ANCHORED"}</strong>{anchoredReceipt ? <><small>{shortHash(anchoredReceipt.receipt.receiptId)}</small><a href={anchoredReceipt.explorerUrl} target="_blank" rel="noreferrer">Anchor tx <ExternalLink size={12} /></a></> : <small>ReceiptRegistry on Base Sepolia.</small>}</div>
              </div>
              <div className="trust-loop-actions">
                <div><p className="panel-kicker">No wallet execution</p><p>IntentGuard uses server-held infrastructure credentials only. It never requests the transaction sender’s private key, seed phrase, or wallet signature.</p></div>
                {!policyCommitment ? <button type="button" className="button-primary" disabled={isWorking || !currentIntent} onClick={handleCommitPolicy}>{commitPolicy.isPending ? <><Loader2 size={16} className="animate-spin" /> Committing policy</> : <>Commit reviewed policy <FileCheck2 size={16} /></>}</button> : <button type="button" className="button-primary" disabled={isWorking || !result.inspection || Boolean(anchoredReceipt)} onClick={handleAnchorReceipt}>{anchorReceipt.isPending ? <><Loader2 size={16} className="animate-spin" /> Anchoring receipt</> : anchoredReceipt ? <>Receipt anchored <Check size={16} /></> : <>Anchor verification receipt <FileCheck2 size={16} /></>}</button>}
              </div>
            </article>

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
                  <pre className="session-json-view" style={{ background: "rgba(0,0,0,0.6)", padding: "16px", borderRadius: "8px", overflowX: "auto", fontSize: "12px", fontFamily: "var(--font-mono)", border: "1px solid rgba(255,255,255,0.08)", marginTop: "12px" }}>
                    <code>{JSON.stringify(verificationSession, null, 2)}</code>
                  </pre>
                )}
              </article>
            )}

            <article className="human-review-panel">
              <div>
                <p className="panel-kicker">Human review record</p>
                <h3>{result.verification.verdict === "MATCH" ? "A human may record the review." : "Approval is blocked until the evidence is sufficient."}</h3>
                <p>{result.verification.verdict === "MATCH" ? "Recording this review is a local browser acknowledgement only. It does not request a signature, connect a wallet, or submit a transaction." : result.verification.verdict === "MISMATCH" ? "IntentGuard will not enable approval because the observed action conflicts with an explicit constraint." : "IntentGuard will not enable approval because one or more required facts remain unavailable."}</p>
              </div>
              <button type="button" className="human-review-button" disabled={result.verification.verdict !== "MATCH" || humanReviewRecorded} onClick={() => setHumanReviewRecorded(true)}>{humanReviewRecorded ? "Review recorded locally" : result.verification.verdict === "MATCH" ? "Record human review" : "Approval unavailable"}</button>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
