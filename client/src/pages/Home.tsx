// Forensic Signal style reminder: keep the page editorial, left-anchored, and honest; use signal orange only for intervention and clear next actions.
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, Menu, ScanLine, ShieldCheck, X } from "lucide-react";
import SignalMark from "@/components/SignalMark";

const heroAsset = "/images/hero.jpg";
const traceAsset = "/images/trace.jpg";
const railAsset = "/images/rail.jpg";
const decisionAsset = "/images/decision.jpg";

const steps = [
  {
    index: "01",
    label: "Pre-Execution",
    title: "Can this proposed transaction safely proceed?",
    body: "Evaluates proposed calldata, contract allowlists, read-only quote evidence, and recipient parameters against human constraints before broadcast.",
  },
  {
    index: "02",
    label: "Post-Execution",
    title: "Did the executed transaction remain consistent?",
    body: "Inspects mined Base Mainnet receipts, emitted transfer logs, real slippage, and state deltas to verify actual behavior against declared intent.",
  },
  {
    index: "03",
    label: "Attestation",
    title: "Produce a cryptographically verifiable verdict.",
    body: "Computes canonical hashes and signs EIP-712 evidence receipts anchored to Base Sepolia smart contracts for smart accounts and audit loops.",
  },
];

function scrollToSection(event: React.MouseEvent<HTMLAnchorElement>) {
  const href = event.currentTarget.getAttribute("href");
  if (!href?.startsWith("#")) return;
  const target = document.querySelector(href);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", href);
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand-lockup" href="#top" onClick={scrollToSection} aria-label="IntentGuard home">
            <span className="brand-mark-frame">
              <SignalMark className="h-5 w-5 text-foreground" />
            </span>
            <span className="brand-name">
              <span>Intent</span>
              <span className="brand-name-muted">Guard</span>
            </span>
          </a>

          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((previous) => !previous)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <nav className={`primary-navigation ${menuOpen ? "is-open" : ""}`} aria-label="Primary">
            <a href="#signal" onClick={(e) => { setMenuOpen(false); scrollToSection(e); }}>Signal Layer</a>
            <a href="#method" onClick={(e) => { setMenuOpen(false); scrollToSection(e); }}>Two Stages</a>
            <a href="#orion" onClick={(e) => { setMenuOpen(false); scrollToSection(e); }}>Orion Trust</a>
            <a href="#principles" onClick={(e) => { setMenuOpen(false); scrollToSection(e); }}>Boundaries</a>
            <a className="nav-action" href="/app">Launch Workspace</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero-section section-shell">
          <div className="signal-rail" aria-hidden="true">
            <span>PRE & POST VERIFICATION</span>
            <i className="rail-active" />
            <i />
            <i />
            <i />
            <i />
          </div>

          <div className="hero-copy">
            <p className="eyebrow"><ScanLine size={14} /> Agent-Compatible Intent Verification / Base</p>
            <h1>Prove that an AI agent did what the human actually asked.</h1>
            <p className="hero-lede">A deterministic trust layer for AI agents that converts human intent into enforceable constraints, independently evaluates proposed blockchain actions, and produces cryptographically verifiable receipts on Base.</p>
            <div className="hero-actions">
              <a className="button-primary" href="/app">Test an Agent Action <ArrowDownRight size={17} /></a>
              <a className="text-action" href="#principles" onClick={scrollToSection}>Security Boundaries <ArrowUpRight size={16} /></a>
            </div>
            <p className="hero-note"><ShieldCheck size={15} /> Non-custodial, read-only policy verification anchored on Base.</p>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-tag">Observed / not assumed</div>
            <img src={heroAsset} alt="Notebook and tracing sheets arranged for an intent review" fetchPriority="high" />
            <div className="hero-caption"><span>Field note 001</span><span>Context changes the route.</span></div>
          </div>
        </section>

        <section id="signal" className="signal-section section-shell">
          <div className="section-intro">
            <p className="eyebrow">The signal layer</p>
            <h2>Clarity is not a score. It is a traceable path.</h2>
            <p>Most AI agent tools jump from prompt to broadcast without verifiable guardrails. IntentGuard separates the two different security questions: pre-execution constraint inspection vs post-execution evidence auditing, producing deterministic verdicts backed by signed EIP-712 receipts.</p>
          </div>
          <div className="trace-panel">
            <img src={traceAsset} alt="Tracing paper, ruler, and orange annotation tab on a mineral paper surface" loading="lazy" />
            <div className="trace-panel-label"><span className="status-dot" /> Context retained</div>
            <p>Keep the original signal close enough to inspect.</p>
          </div>
        </section>

        <section id="method" className="method-section section-shell">
          <div className="section-kicker-row">
            <p className="eyebrow">Two Distinct Security Problems</p>
            <p className="mono-note">03 / stages of verification</p>
          </div>
          <div className="method-grid">
            <div className="method-image-panel">
              <img src={railAsset} alt="Abstract vertical signal rail made of wayfinding markers and hairline paths" loading="lazy" />
              <div className="method-image-caption">Pre-flight check vs Post-execution proof</div>
            </div>
            <div className="steps-list">
              {steps.map((step) => (
                <article className="step-item" key={step.index}>
                  <div className="step-index">{step.index}</div>
                  <div>
                    <p className="step-label">{step.label}</p>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                  <Check className="step-check" size={19} strokeWidth={1.7} />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Orion Ecosystem Integration Section */}
        <section id="orion" className="orion-section section-shell">
          <div className="section-intro">
            <p className="eyebrow">Orion Ecosystem Trust Layer</p>
            <h2>Empowering Orion agents with cryptographic intent fidelity.</h2>
            <p className="orion-lead-copy">
              <strong>IntentGuard gives Orion agents a cryptographic <em>“did this action actually match the user’s intent?”</em> layer.</strong> Instead of asking users to blindly trust autonomous AI proposals, IntentGuard evaluates candidate actions against policy commitments and generates tamper-evident receipts that build verifiable agent reputation on Base.
            </p>
          </div>

          <div className="orion-flow-grid">
            <div className="orion-flow-step">
              <div className="orion-step-badge">01 / PROPOSE</div>
              <h3>Orion Agent Workflow</h3>
              <p>The autonomous agent plans multi-step operations and constructs candidate transaction parameters and calldata.</p>
            </div>
            <div className="orion-flow-arrow" aria-hidden="true">→</div>
            <div className="orion-flow-step">
              <div className="orion-step-badge">02 / VERIFY</div>
              <h3>IntentGuard Engine</h3>
              <p>Deterministically evaluates candidate proposals against human constraints. Produces MATCH / BLOCK decisions.</p>
            </div>
            <div className="orion-flow-arrow" aria-hidden="true">→</div>
            <div className="orion-flow-step">
              <div className="orion-step-badge">03 / ATTEST</div>
              <h3>On-Chain Reputation</h3>
              <p>Anchors EIP-712 receipts to Base Sepolia, creating an immutable cryptographic audit trail and provenance record.</p>
            </div>
          </div>
        </section>

        <section id="principles" className="principles-section section-shell">
          <div className="principles-copy">
            <p className="eyebrow">The guardrail boundary</p>
            <h2>Honest security boundaries.</h2>
            <p>Pre-execution ("Can this safely proceed?") and post-execution ("Did it execute as promised?") require different evidence. IntentGuard provides deterministic decoding, live RPC inspection, and cryptographic attestations without touching private keys, holding custody, or executing transactions.</p>
            <div className="llm-boundary-quote">
              <strong>THE ARCHITECTURAL GUARANTEE:</strong>
              <p>“The model may help interpret intent. It does not decide whether the transaction is safe.”</p>
            </div>
            <a className="text-action" href="#top" onClick={scrollToSection}>Back to top <ArrowUpRight size={16} /></a>
          </div>
          <div className="decision-card">
            <img src={decisionAsset} alt="Folded paper map showing branching paths and a signal-orange clip" loading="lazy" />
            <div className="decision-card-copy">
              <span className="decision-card-index">Decision note / 003</span>
              <p>Natural Language → Parser → IntentSpec → Schema Validation → Canonical Policy → Deterministic Engine → Verdict.</p>
            </div>
          </div>
        </section>

        <section className="closing-section section-shell">
          <div className="closing-mark"><SignalMark className="h-12 w-12 text-signal" /></div>
          <p className="eyebrow">A calmer way to handle ambiguity</p>
          <h2>See what the signal means.<br />Decide what happens next.</h2>
          <a className="button-primary" href="/app">Test an Agent Action <ArrowUpRight size={17} /></a>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <span>© 2026 IntentGuard</span>
          <span className="footer-rule" />
          <span>Context before action.</span>
        </div>
      </footer>
    </div>
  );
}
