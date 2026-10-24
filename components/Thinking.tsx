"use client";

import { useEffect, useState } from "react";

/**
 * Shows what Chrono actually checked, one step at a time, then reveals the result.
 * The steps describe real work done by the engine. Plays once per order per session,
 * and is instant with reduced motion.
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
    }, 420);
    return () => clearInterval(timer);
  }, [runKey, steps.length]);

  const ready = stage >= steps.length;
  return (
    <>
      <ol className="thinking" aria-label="What Chrono checked">
        {steps.map((s, i) => (
          <li key={s} data-state={i < stage ? "done" : i === stage ? "active" : "waiting"}>
            <span className="tick" aria-hidden="true">
              {i < stage ? "✓" : ""}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="reveal" data-ready={ready}>
        {children}
      </div>
    </>
  );
}
