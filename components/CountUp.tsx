"use client";

import { useEffect, useState } from "react";
import { formatRand } from "@/lib/engine";

/** A rand amount that counts up when it first appears. Instant with reduced motion. */
export function CountUp({ cents, durationMs = 900 }: { cents: number; durationMs?: number }) {
  const [shown, setShown] = useState(cents);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(cents);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round((cents * eased) / 100) * 100);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cents, durationMs]);

  return <span className="num">{formatRand(shown)}</span>;
}
