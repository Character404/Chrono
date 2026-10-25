"use client";

import { useFormStatus } from "react-dom";

/** A submit button that shows it's working while the server action runs. */
export function SubmitButton({ children, pendingLabel, className = "btn", ariaLabel }: { children: React.ReactNode; pendingLabel: string; className?: string; ariaLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending} aria-label={ariaLabel} style={pending ? { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.45rem" } : undefined}>
      {pending && <span className="spinner" aria-hidden="true" style={{ display: "inline-block", width: "1em", height: "1em", flex: "none", verticalAlign: "-0.15em" }} />}
      {pending ? pendingLabel : children}
    </button>
  );
}
