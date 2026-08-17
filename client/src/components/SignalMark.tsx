// Forensic Signal style reminder: use the guard mark as a precise, quiet wayfinding symbol; never decorate it with gradients or glow.
import type { SVGProps } from "react";

type SignalMarkProps = SVGProps<SVGSVGElement> & {
  decorative?: boolean;
};

export default function SignalMark({ decorative = true, ...props }: SignalMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={decorative}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "IntentGuard mark"}
      {...props}
    >
      <path d="M8 17.5V10h7.5M40 17.5V10h-7.5M8 30.5V38h7.5M40 30.5V38h-7.5" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
      <path d="M14 13.5 24 8l10 5.5v21L24 40l-10-5.5v-21Z" stroke="currentColor" strokeWidth="2.2" opacity=".42" />
      <circle cx="24" cy="24" r="4.5" fill="currentColor" />
    </svg>
  );
}
