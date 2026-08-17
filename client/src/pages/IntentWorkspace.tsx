// Forensic Signal style reminder: show the evidence trail before the visual verdict; never imply a successful chain action or wallet approval that did not occur.
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowUpRight, Braces, Check, ChevronDown, CircleAlert, ExternalLink, FileCheck2, Loader2, ScanLine, ShieldAlert, ShieldCheck } from "lucide-react";
import SignalMark from "@/components/SignalMark";
import { trpc } from "@/lib/trpc";

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

function verdictLabel(verdict: "MATCH" | "MISMATCH" | "UNVERIFIABLE") {
  if (verdict === "MATCH") return "Intent match";
  if (verdict === "MISMATCH") return "Intent mismatch";
  return "Cannot verify";
}

export default function IntentWorkspace() {
  const [intentText, setIntentText] = useState(examples[0].text);
  const [transactionHash, setTransactionHash] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [humanReviewRecorded, setHumanReviewRecorded] = useState(false);
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/" className="brand-lockup" aria-label="Return to IntentGuard landing page">
            <span className="brand-mark-frame"><SignalMark className="h-5 w-5 text-foreground" /></span>
            <span className="brand-name"><span>Intent</span><span className="brand-name-muted">Guard</span></span>
          </Link>
          <div className="app-header-context"><span>Base Mainnet</span><span className={`rpc-indicator ${baseHealth.data?.status === "reachable" ? "is-live" : ""}`} /> {baseHealth.isLoading ? "Checking RPC" : baseHealth.data?.status === "reachable" ? "Live RPC" : "RPC unavailable"}</div>
          <Link href="/" className="app-return"><ArrowLeft size={15} /> Field guide</Link>
        </div>
      </header>

      <main className="app-main section-shell">
        <div className="app-signal-rail" aria-hidden="true">
          <span>IG / BASE / 01</span>
          <i className="rail-active" />
          <i />
          <i />
          <i />
          <i />
        </div>
        <section className="app-intro">
          <div>
            <p className="eyebrow"><ScanLine size={14} /> Deterministic Intent Verification / Base</p>
            <h1>Test an agent action against the limits you actually set.</h1>
          </div>
          <p>IntentGuard is a deterministic intent-verification and attestation layer for AI agent transactions on Base. It compares human-declared constraints with observable transaction behavior and produces a cryptographically verifiable verdict before or after execution, depending on available evidence.</p>
        </section>

        <div className="app-workspace-grid">
          <section className="composer-panel" aria-labelledby="composer-title">
            <div className="panel-heading">
              <span className="panel-index">01</span>
              <div><p className="panel-kicker">Human intent</p><h2 id="composer-title">What are you trying to do?</h2></div>
            </div>
            <form onSubmit={handleExtract} className="intent-form">
              <label htmlFor="intent-text">Use natural language. Base must be explicit.</label>
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
            <p className="panel-kicker">Two distinct security stages</p>
            <h2>Pre-execution vs. Post-execution</h2>
            <p><strong>Pre-execution:</strong> Can this proposed transaction safely proceed according to declared intent? <br /><br /><strong>Post-execution:</strong> Did the transaction that actually executed remain consistent with declared intent? <br /><br />IntentGuard inspects observable calldata and mined Base RPC receipts to produce deterministic verdicts and signed attestations without ever touching private keys.</p>
          </aside>
        </div>

        {errorMessage && <div className="app-error" role="alert"><CircleAlert size={18} /><div><strong>No verification decision was made.</strong><span>{errorMessage}</span></div></div>}

        {currentIntent && (
          <section className="intent-review-section" aria-labelledby="intent-review-title">
            <div className="section-kicker-row"><p className="eyebrow">Review before inspection</p><p className="mono-note">schema validated</p></div>
            <div className="intent-review-grid">
              <div className="intent-summary">
                <p className="panel-kicker">02 / Structured intent</p>
                <h2 id="intent-review-title">These are the limits IntentGuard will enforce.</h2>
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

        <div className="chain-of-custody" aria-label="Verification workflow sequence">
          <span>02 / Constraints</span><i /><span>03 / Proposed action</span><i /><span>04 / Evidence</span><i /><span>05 / Human review</span>
        </div>

        <section className="transaction-entry-section" aria-labelledby="transaction-title">
          <div className="panel-heading"><span className="panel-index">03</span><div><p className="panel-kicker">Agent / transaction proposal</p><h2 id="transaction-title">Inspect a real Base transaction.</h2></div></div>
          <p className="transaction-entry-copy">Paste a transaction hash from Base Mainnet. IntentGuard retrieves the actual transaction and receipt from Base RPC; it will report <strong>UNVERIFIABLE</strong> when the available evidence is incomplete.</p>
          <div className="hash-form">
            <label htmlFor="transaction-hash">Base transaction hash</label>
            <div className="hash-control"><input id="transaction-hash" value={transactionHash} onChange={(event) => { setTransactionHash(event.target.value); setClientError(null); }} placeholder="0x…" inputMode="text" autoComplete="off" spellCheck="false" /><button type="button" className="button-primary" onClick={handleVerify} disabled={isWorking || !currentIntent}>{verifyIntent.isPending ? <><Loader2 size={16} className="animate-spin" /> Inspecting Base</> : <>Verify action <FileCheck2 size={16} /></>}</button></div>
            {!currentIntent && <p className="form-note">Extract and review the intent first. No verification request will be sent until the policy is visible.</p>}
          </div>
        </section>

        {verifyIntent.isPending && <section className="verification-progress inspector-progress" aria-live="polite" aria-busy="true" aria-label="Live Base transaction inspection in progress"><div className="inspection-progress-heading"><Loader2 size={18} className="animate-spin" /><div><strong>Live Base inspection is in progress.</strong><span>The server will return transaction, receipt, router, quote, and policy evidence together. No stage is marked complete until that evidence arrives.</span></div></div><ol className="inspection-stage-list">{inspectionStages.map((stage) => <li key={stage.id} className="stage-pending"><span>{stage.id}</span><div><strong>{stage.label}</strong><small>{stage.detail}</small></div></li>)}</ol><div className="inspection-progress-meter is-indeterminate" aria-hidden="true"><i /></div></section>}

        {result && (
          <section className="verification-output" aria-labelledby="verification-title">
            <div className="section-kicker-row"><p className="eyebrow">Evidence-led verification</p><p className="mono-note">{result.verification.receiptId}</p></div>
            <div className="verdict-grid">
              <article className={`verdict-card verdict-${result.verification.verdict.toLowerCase()}`}>
                <div className="verdict-icon">{result.verification.verdict === "MATCH" ? <ShieldCheck size={29} /> : <ShieldAlert size={29} />}</div>
                <p className="panel-kicker">04 / Verdict</p>
                <h2 id="verification-title">{verdictLabel(result.verification.verdict)}</h2>
                <p>{result.verification.summary}</p>
                <div className="verdict-counts"><span>{result.verification.passedChecks} passed</span><span>{result.verification.failedChecks} failed</span><span>{result.verification.unavailableChecks} unavailable</span></div>
              </article>

              <article className="transaction-panel">
                <div className="receipt-heading"><p className="panel-kicker">Observed transaction</p>{result.inspection && <a href={`https://basescan.org/tx/${result.inspection.transactionHash}`} target="_blank" rel="noreferrer">View on BaseScan <ExternalLink size={13} /></a>}</div>
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

            <div className="result-details-grid">
              <article className="evidence-panel"><div className="receipt-heading"><p className="panel-kicker">Evidence</p><span>{result.verification.evidence.length} checks</span></div><ul className="evidence-list">{result.verification.evidence.map((item) => <li key={item.id} className={`evidence-${item.state}`}><span className="evidence-state">{item.state === "verified" ? <Check size={14} /> : item.state === "failed" ? <CircleAlert size={14} /> : "?"}</span><div><strong>{item.label}</strong><p>{item.detail}</p><small>{item.source}</small>{result.inspection && <details className="evidence-row-details"><summary>Inspect source fields <ChevronDown size={13} /></summary><dl><div><dt>Evidence source</dt><dd>{item.source}</dd></div><div><dt>Transaction</dt><dd className="address-value">{result.inspection.transactionHash}</dd></div><div><dt>Selector</dt><dd>{result.inspection.decoded.selector ?? "Unavailable"}</dd></div><div><dt>Destination</dt><dd className="address-value">{result.inspection.transaction?.to ?? "Unavailable"}</dd></div>{result.inspection.decoded.routerSwap && <><div><dt>Token in</dt><dd className="address-value">{result.inspection.decoded.routerSwap.tokenIn}</dd></div><div><dt>Token out</dt><dd className="address-value">{result.inspection.decoded.routerSwap.tokenOut}</dd></div><div><dt>Fee / recipient</dt><dd>{result.inspection.decoded.routerSwap.fee} / {shortHash(result.inspection.decoded.routerSwap.recipient)}</dd></div><div><dt>Amount in / minimum</dt><dd>{result.inspection.decoded.routerSwap.amountInRaw} / {result.inspection.decoded.routerSwap.amountOutMinimumRaw}</dd></div><div><dt>Price limit</dt><dd>{result.inspection.decoded.routerSwap.sqrtPriceLimitX96Raw}</dd></div></>}{item.source === "Read-only QuoterV2" && <><div><dt>Quote state / block</dt><dd>{result.inspection.simulation.state.toUpperCase()} / {result.inspection.simulation.blockTag ?? "not requested"}</dd></div><div><dt>Quote contract</dt><dd className="address-value">{result.inspection.simulation.contractAddress ?? "Unavailable"}</dd></div><div><dt>Method / selector</dt><dd>{result.inspection.simulation.method ?? "Unavailable"} / {result.inspection.simulation.selector ?? "Unavailable"}</dd></div><div><dt>Output / gas estimate</dt><dd>{result.inspection.simulation.amountOutRaw ?? "Unavailable"} / {result.inspection.simulation.gasEstimate ?? "Unavailable"}</dd></div></>}</dl></details>}</div></li>)}</ul></article>
              <article className="trace-panel-app"><div className="receipt-heading"><p className="panel-kicker">Agent trace</p><span>actual operations</span></div><ol>{result.trace.map((step) => <li key={step.id} className={`trace-${step.state}`}><span>{step.id}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div></li>)}</ol></article>
            </div>

            <article className="intent-receipt"><div className="receipt-heading"><p className="panel-kicker">Intent receipt</p><span>Verified at {new Date(result.verification.observedAt).toLocaleString()}</span></div><div className="receipt-grid"><div><span>ID</span><strong>{result.verification.receiptId}</strong></div><div><span>Intent</span><strong>{result.intent.action.toUpperCase()} / {result.intent.maxSpendUsdc} USDC / BASE</strong></div><div><span>Result</span><strong className={`receipt-${result.verification.verdict.toLowerCase()}`}>{result.verification.verdict}</strong></div><div><span>Approval boundary</span><strong>NO SIGNATURE REQUESTED</strong></div></div></article>
            <article className="trust-loop-panel" aria-labelledby="trust-loop-title">
              <div className="receipt-heading"><p className="panel-kicker" id="trust-loop-title">Verification receipt</p><span>Base Sepolia attestation infrastructure</span></div>
              <p className="trust-loop-copy">The Base Mainnet verdict remains a read-only inspection. The controls below commit the canonical policy and anchor a signed, independently attributable receipt on Base Sepolia only after transaction confirmation and on-chain readback validation.</p>
              <div className="trust-loop-grid">
                <div><span>Policy</span><strong className={policyCommitment ? "trust-confirmed" : "trust-pending"}>{policyCommitment ? "COMMITTED" : "NOT COMMITTED"}</strong>{policyCommitment ? <><small>{shortHash(policyCommitment.policyId)}</small><a href={policyCommitment.explorerUrl} target="_blank" rel="noreferrer">Commitment tx <ExternalLink size={12} /></a></> : <small>No policy transaction has been confirmed.</small>}</div>
                <div><span>Verdict</span><strong className={`receipt-${result.verification.verdict.toLowerCase()}`}>{result.verification.verdict === "UNVERIFIABLE" ? "CANNOT VERIFY" : result.verification.verdict}</strong><small>{verdictLabel(result.verification.verdict)}</small></div>
                <div><span>Evidence hash</span><strong className={anchoredReceipt ? "trust-confirmed address-value" : "trust-pending"}>{anchoredReceipt ? shortHash(anchoredReceipt.receipt.evidenceHash) : "NOT GENERATED"}</strong><small>{anchoredReceipt ? "Bound into the anchored receipt." : "Generated only during anchoring."}</small></div>
                <div><span>Attestation</span><strong className={anchoredReceipt ? "trust-confirmed" : "trust-pending"}>{anchoredReceipt ? "SIGNED / RECOVERED" : "NOT SIGNED"}</strong><small>{anchoredReceipt ? `Evaluator ${shortHash(anchoredReceipt.receipt.evaluator)}` : "No evaluator signature has been returned."}</small></div>
                <div><span>On-chain</span><strong className={anchoredReceipt ? "trust-confirmed" : "trust-pending"}>{anchoredReceipt ? "ANCHORED" : "NOT ANCHORED"}</strong>{anchoredReceipt ? <><small>{shortHash(anchoredReceipt.receipt.receiptId)}</small><a href={anchoredReceipt.explorerUrl} target="_blank" rel="noreferrer">Anchor tx <ExternalLink size={12} /></a></> : <small>No confirmed receipt transaction exists.</small>}</div>
                <div><span>Transaction subject</span><strong className="address-value">{result.inspection?.transaction?.from ? shortHash(result.inspection.transaction.from) : "UNAVAILABLE"}</strong><small>Independent from the policy committer.</small></div>
              </div>
              <div className="trust-loop-actions">
                <div><p className="panel-kicker">No wallet execution</p><p>IntentGuard uses server-held infrastructure credentials only. It never requests the transaction sender’s private key, seed phrase, or wallet signature.</p></div>
                {!policyCommitment ? <button type="button" className="button-primary" disabled={isWorking || !currentIntent} onClick={handleCommitPolicy}>{commitPolicy.isPending ? <><Loader2 size={16} className="animate-spin" /> Committing policy</> : <>Commit reviewed policy <FileCheck2 size={16} /></>}</button> : <button type="button" className="button-primary" disabled={isWorking || !result.inspection || Boolean(anchoredReceipt)} onClick={handleAnchorReceipt}>{anchorReceipt.isPending ? <><Loader2 size={16} className="animate-spin" /> Anchoring receipt</> : anchoredReceipt ? <>Receipt anchored <Check size={16} /></> : <>Anchor verification receipt <FileCheck2 size={16} /></>}</button>}
              </div>
            </article>
            <article className="human-review-panel">
              <div>
                <p className="panel-kicker">05 / Human approval</p>
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
