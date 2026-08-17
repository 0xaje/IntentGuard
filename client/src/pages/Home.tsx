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
    label: "Capture",
    title: "Preserve the signal before it gets interpreted.",
    body: "IntentGuard gives teams a shared frame for the words, context, and constraints that shape a request.",
  },
  {
    index: "02",
    label: "Inspect",
    title: "Separate what is said from what is being asked.",
    body: "Read the visible intent alongside the conditions that can change its meaning, without hiding uncertainty behind a score.",
  },
  {
    index: "03",
    label: "Route",
    title: "Make the next action accountable.",
    body: "Give the right person the right context, with a clear record of why the action moved forward or stopped.",
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
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <nav id="primary-navigation" className={`primary-navigation ${menuOpen ? "is-open" : ""}`} aria-label="Primary navigation">
            <a href="#method" onClick={(event) => { scrollToSection(event); setMenuOpen(false); }}>Method</a>
            <a href="#signal" onClick={(event) => { scrollToSection(event); setMenuOpen(false); }}>Signal</a>
            <a href="#principles" onClick={(event) => { scrollToSection(event); setMenuOpen(false); }}>Principles</a>
            <a className="nav-action" href="/app" onClick={() => setMenuOpen(false)}>
              Test an Agent Action <ArrowUpRight size={15} strokeWidth={1.8} />
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero-section section-shell">
          <div className="signal-rail" aria-hidden="true">
            <span className="rail-label">IG / 001</span>
            <span className="rail-spine" />
            <span className="rail-point rail-point-active" />
            <span className="rail-point rail-point-mid" />
            <span className="rail-point rail-point-low" />
          </div>

          <div className="hero-copy">
            <p className="eyebrow"><ScanLine size={14} /> Intent intelligence / field guide</p>
            <h1>Read the intent before you route the action.</h1>
            <p className="hero-lede">IntentGuard helps teams turn ambiguous requests into decisions that can be inspected, explained, and responsibly moved forward.</p>
            <div className="hero-actions">
              <a className="button-primary" href="/app">Test an Agent Action <ArrowDownRight size={17} /></a>
              <a className="text-action" href="#principles" onClick={scrollToSection}>Why it matters <ArrowUpRight size={16} /></a>
            </div>
            <p className="hero-note"><ShieldCheck size={15} /> Built for teams where context is part of the control.</p>
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
            <p>Most systems jump from input to output. IntentGuard leaves room for the reasoning between them, so people can see what changed, what remains unclear, and who owns the next decision.</p>
          </div>
          <div className="trace-panel">
            <img src={traceAsset} alt="Tracing paper, ruler, and orange annotation tab on a mineral paper surface" loading="lazy" />
            <div className="trace-panel-label"><span className="status-dot" /> Context retained</div>
            <p>Keep the original signal close enough to inspect.</p>
          </div>
        </section>

        <section id="method" className="method-section section-shell">
          <div className="section-kicker-row">
            <p className="eyebrow">A readable operating method</p>
            <p className="mono-note">03 / steps before action</p>
          </div>
          <div className="method-grid">
            <div className="method-image-panel">
              <img src={railAsset} alt="Abstract vertical signal rail made of wayfinding markers and hairline paths" loading="lazy" />
              <div className="method-image-caption">One signal / many possible routes</div>
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

        <section id="principles" className="principles-section section-shell">
          <div className="principles-copy">
            <p className="eyebrow">The guardrail</p>
            <h2>Make the next move easier to trust.</h2>
            <p>IntentGuard is designed for the moment when a request looks simple but the consequences are not. It gives teams a durable way to pause, inspect, and proceed with the context still attached.</p>
            <a className="text-action" href="#top" onClick={scrollToSection}>Back to the field guide <ArrowUpRight size={16} /></a>
          </div>
          <div className="decision-card">
            <img src={decisionAsset} alt="Folded paper map showing branching paths and a signal-orange clip" loading="lazy" />
            <div className="decision-card-copy">
              <span className="decision-card-index">Decision note / 003</span>
              <p>When the context changes, the route should show its work.</p>
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
