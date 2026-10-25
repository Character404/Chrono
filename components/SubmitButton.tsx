"use client";

import { useFormStatus } from "react-dom";

/** A submit button that shows it's working while the server action runs. */
export function SubmitButton({ children, pendingLabel, className = "btn", ariaLabel }: { children: React.ReactNode; pendingLabel: string; className?: string; ariaLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending} aria-label={ariaLabel}>
      {pending && <span className="spinner" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}
