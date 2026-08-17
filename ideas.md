# IntentGuard design direction

## Working scope

This first build treats IntentGuard as a public-facing product website for a serious intent and risk intelligence platform. The interface will communicate clarity, traceability, and controlled action without inventing customer evidence, analytics, testimonials, or operational outcomes. Any live product data will be introduced only through an explicit real integration in a later scope.

## Three stylistic approaches

### Theme Name: Forensic Signal

Very Brief Intro: A calm editorial-security system that turns ambiguity into a readable signal. Warm paper tones, ink-blue structure, and a singular warning orange make the product feel trustworthy rather than alarmist.

Probability: 0.07

### Theme Name: Quiet Control Room

Very Brief Intro: A low-light operations console with disciplined panels, clipped labels, and restrained red status cues. The mood is focused and technical, built for teams who need to see the next safe action quickly.

Probability: 0.04

### Theme Name: Civic Ledger

Very Brief Intro: A public-interest visual language inspired by municipal records, transit maps, and legal annotation. Dense information is balanced by generous margins, making the product feel accountable and legible.

Probability: 0.02

## Chosen approach: Forensic Signal

### Design Movement

Contemporary editorial modernism with cues from information design, investigative print, and utilitarian wayfinding. The result should feel like a trusted field instrument, not a speculative AI dashboard.

### Core Principles

1. Make the invisible legible: turn ambiguous intent into clear, inspectable steps.
2. Use contrast with restraint: reserve the signature orange for moments that need attention, not decoration.
3. Let structure create confidence: asymmetry, rules, and labels should carry meaning.
4. Never imply evidence that does not exist: interface copy must stay specific and honest.

### Color Philosophy

The base is a mineral parchment rather than stark white, which gives the page the feeling of an annotated working document. Ink navy anchors hierarchy and signals seriousness. Moss green marks verified or understood states without the false certainty of bright success green. Signal orange is the ownable intervention color: it appears only where the system asks a person to pause, inspect, or decide.

### Layout Paradigm

Use a left-anchored editorial composition with a narrow “signal rail” and a wider narrative field. Important content should not sit in a single centered stack. Hero content can occupy two-thirds of the canvas while the rail holds a live-feeling but explicitly non-fabricated workflow index. Section transitions should use rule lines, offset blocks, and short labels rather than repeated rounded cards.

### Signature Elements

1. A vertical signal rail with tiny indexed markers, used to orient the visitor through the product story.
2. Hairline rules and annotation labels that make the page feel inspected and accountable.
3. The “guard mark”: a compact abstract shield made from two offset brackets enclosing a single point, used as logo, favicon, and recurring accent.

### Interaction Philosophy

Interactions should feel like checking a record, not triggering a toy. Hover states reveal context through a short underline or measured color shift. Buttons should use direct verbs and clear focus states. Any interactive preview must describe the action it is simulating; it must never present fabricated live metrics as if they were customer data.

### Animation

Motion is sparse and purposeful. On first load, the signal rail draws in from top to bottom while the hero text enters with a short 16px horizontal settle. Section labels may reveal with a 30ms stagger. Hover transitions should stay between 140ms and 220ms, using transform and opacity only. No perpetual loops, flashing indicators, or animated statistics. Respect `prefers-reduced-motion` by removing non-essential reveals.

### Typography System

Use **DM Sans** for readable interface copy and **IBM Plex Mono** for labels, metadata, and system annotations. Headlines use DM Sans at a heavy weight with tight tracking; body copy stays at a relaxed reading measure. All-caps mono labels are small but never below 11px. The word “IntentGuard” should be rendered as a custom lockup with a compact guard mark, not as a plain text logo.

### Brand Essence

IntentGuard is a clarity layer for teams that must interpret intent before acting, built for operators and product leaders who value traceability over theatrics. Personality: **measured, vigilant, useful**.

### Brand Voice

Headlines are concise and declarative. CTAs describe the next concrete action. Microcopy acknowledges uncertainty rather than overstating capability.

Example lines:

> Read the intent before you route the action.

> See what the signal means. Decide what happens next.

### Wordmark & Logo

The mark is a bold graphic symbol with two offset guard brackets forming a shallow shield around one central point. The wordmark pairs a heavy DM Sans “Intent” with a monospaced “Guard” label, separated by a compact orange point. The symbol must also work alone at favicon size and remain recognizable in one color.

### Signature Brand Color

**Signal orange — `#E7653D`**. It is warm enough to feel human and sharp enough to identify intervention. It should never be used as a decorative gradient or applied to large text blocks.

## Implementation guardrails

- No mock, simulator, fake fallback, fabricated testimonials, or invented customer metrics.
- No backend or server changes in this static frontend build.
- No secret values in source control; environment files and local credentials remain ignored.
- Every user-facing interaction must either perform a real local UI action or be clearly marked as unavailable until a real integration is connected.
