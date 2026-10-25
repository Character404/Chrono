"use client";

import { useEffect, useState } from "react";

/**
 * One line that ticks through what Chrono actually checked, then settles to
 * "Checked N things" and reveals the answer. Plays once per order per session;
 * instant with reduced motion.
 */
export function Thinking({ runKey, steps, children }: { runKey: string; steps: string[]; children: React.ReactNode }) {
  const [stage, setStage] = useState(steps.length);

  useEffect(() => {
    const key = `chrono-checked-${runKey}`;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {
      seen = false;
    }
    if (reduced || seen) return;
    setStage(0);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setStage(i);
      if (i >= steps.length) clearInterval(timer);
    }, 320);
    return () => clearInterval(timer);
  }, [runKey, steps.length]);

  const ready = stage >= steps.length;
  return (
    <>
      <p className="thinking-line" aria-live="polite" title={steps.join("\n")} data-tour="checked">
        {ready ? (
          <>
            <span className="tick tick-done" aria-hidden="true">
              ✓
            </span>
            Chrono checked {steps.length} things before answering
          </>
        ) : (
          <>
            <span className="spinner" aria-hidden="true" />
            {steps[stage]}…
          </>
        )}
      </p>
      <div className="reveal" data-ready={ready}>
        {children}
      </div>
    </>
  );
}
