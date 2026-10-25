"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The 90-second narrated demo. It lives in the root layout, so it keeps running
 * while it moves between pages: login → sign-up → demo home → the wedding order.
 * Nothing runs unless someone taps "Watch the 90-second tour".
 */

export interface TourScriptStep {
  /** Shown as the caption, and spoken unless `speech` is given. */
  say: string;
  /** What the voice says, when it should differ from the caption (e.g. "2,300 rand" for "R2,300"). */
  speech?: string;
  /** data-tour value of the element to highlight and scroll to. */
  target?: string;
  /** Open this tap-to-open section first. */
  open?: string;
  /** Go to this page first. */
  path?: string;
}

declare global {
  interface Window {
    __chronoTourScenes?: Record<string, TourScriptStep[]>;
  }
}

const START_EVENT = "chrono-tour-start";
const PAUSE_MS = 60;

/**
 * The narration: BinaryBros' own recorded clips in public/tour-audio, played as recorded
 * (never sped up or cut). Lengths in seconds, used only if a clip can't play.
 */
const CLIP_SECONDS = [7.63, 1.65, 4.21, 4.99, 11.15, 5.96, 8.28, 8.05, 4.83, 6.19, 5.64, 4.28, 3.24, 6.84, 4.21];
const CLIP_LABELS = [
  "Welcome to Chrono",
  "Registering a business",
  "Lerato's catering business in Soshanguve",
  "Her dashboard",
  "Thabo's wedding order",
  "The forecast: a potential cash shortfall",
  "Why: costs, Thabo's payments and upcoming expenses",
  "Applying the recommended deposit",
  "Red to green",
  "Quote in English or Sepedi, shared on WhatsApp",
  "Customers: how each customer pays",
  "Payments: regular commitments",
  "Monthly summary",
  "Know before you commit",
  "Chrono by BinaryBros",
];

declare global {
  interface Window {
    __chronoTourAudio?: HTMLAudioElement;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(check: () => T | null | undefined | false, timeoutMs: number): Promise<T | null> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = check();
    if (v) return v as T;
    await sleep(100);
  }
  return null;
}

/** One audio element, unlocked by the tap that starts the tour (required on phones). */
function tourAudio(): HTMLAudioElement {
  if (!window.__chronoTourAudio) window.__chronoTourAudio = new Audio();
  return window.__chronoTourAudio;
}

/**
 * Plays clip n to the end. `at` runs an action a set time before the clip finishes,
 * so the screen changes exactly on cue. Falls back to the clip's length if audio can't play.
 */
function playClip(n: number, at?: { secondsBeforeEnd: number; run: () => void }): Promise<void> {
  const audio = tourAudio();
  const seconds = CLIP_SECONDS[n - 1];
  return new Promise((resolve) => {
    let done = false;
    let fired = false;
    const fire = () => {
      if (at && !fired) {
        fired = true;
        at.run();
      }
    };
    const finish = () => {
      if (done) return;
      done = true;
      fire();
      audio.onended = null;
      audio.ontimeupdate = null;
      clearTimeout(fallback);
      resolve();
    };
    const fallback = setTimeout(finish, (seconds + 2.5) * 1000);
    audio.ontimeupdate = () => {
      if (at && audio.duration && audio.duration - audio.currentTime <= at.secondsBeforeEnd) fire();
    };
    audio.onended = finish;
    audio.src = `/tour-audio/clip_${n}.mp3`;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Couldn't play (e.g. blocked): keep the timing with captions only.
      if (at) setTimeout(fire, Math.max(0, seconds - at.secondsBeforeEnd) * 1000);
      clearTimeout(fallback);
      setTimeout(finish, seconds * 1000);
    });
  });
}

export function TourHost() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [clip, setClip] = useState(0);
  const [finished, setFinished] = useState(false);
  const [endCard, setEndCard] = useState(false);
  const endCardRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const cancelledRef = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<Element | null>(null);
  const shadeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (window.__chronoTourAudio) window.__chronoTourAudio.muted = muted;
  }, [muted]);

  useEffect(() => {
    let focused: Element | null = null;
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const focusNow = (target?: string) => {
      focused?.classList.remove("tour-focus");
      focused = null;
      targetRef.current = null;
      if (!target) return;
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (!el) return;
      el.classList.add("tour-focus");
      el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
      focused = el;
      targetRef.current = el;
    };
    /** Highlights a target as soon as it appears, without holding up the narration. */
    const focusWhenReady = (target?: string) => {
      if (!target) return focusNow(undefined);
      void waitFor(() => document.querySelector(`[data-tour="${target}"]`), 5000).then((el) => {
        if (el && !cancelledRef.current) focusNow(target);
      });
    };
    const openFold = (name: string) => {
      const fold = document.querySelector(`[data-tour="${name}"]`);
      if (fold instanceof HTMLDetailsElement) fold.open = true;
    };
    const go = (path: string) => {
      if (window.location.pathname !== path) router.push(path);
    };
    const say = async (n: number, target?: string, at?: { secondsBeforeEnd: number; run: () => void }) => {
      if (cancelledRef.current) return false;
      setClip(n);
      focusWhenReady(target);
      await playClip(n, at);
      if (cancelledRef.current) return false;
      await sleep(PAUSE_MS);
      return true;
    };

    const run = async () => {
      cancelledRef.current = false;
      setActive(true);
      setFinished(false);
      setEndCard(false);
      endCardRef.current = false;

      go("/login");
      await waitFor(() => window.location.pathname === "/login", 6000);
      if (!(await say(1, "intro"))) return;

      go("/signup");
      if (!(await say(2, "signup-process"))) return;

      // Clip 3 plays while the demo opens.
      go("/login");
      const opened = (async () => {
        const button = await waitFor(() => document.querySelector<HTMLButtonElement>('[data-tour="demo"] button'), 6000);
        focusNow("demo");
        button?.click();
      })();
      if (!(await say(3))) return;
      await opened;
      await waitFor(() => window.location.pathname === "/home", 20000);
      if (!(await say(4, "home-hero"))) return;

      // Clip 5 plays while the wedding order opens.
      document.querySelector<HTMLAnchorElement>('a[data-tour="wedding"]')?.click();
      if (!(await say(5, "summary"))) return;
      if (!(await say(6, "verdict"))) return;
      if (!(await say(7, "why"))) return;

      // Clip 8: tap the deposit as the narration says "We apply that amount here" (about 5.6s in),
      // so the verdict turns green during "...and check how it changes the forecast."
      const fix = { secondsBeforeEnd: 2.45, run: () => document.querySelector<HTMLButtonElement>('[data-tour="fix"] button')?.click() };
      if (!(await say(8, "fix", fix))) return;
      await waitFor(() => document.querySelector(".verdict-SAFE"), 8000);
      if (!(await say(9, "verdict"))) return;

      openFold("share");
      document.querySelector<HTMLInputElement>('[data-tour="lang-nso"] input')?.click();
      if (!(await say(10, "doc-preview"))) return;

      go("/customers");
      if (!(await say(11, "customers-list"))) return;
      go("/commitments");
      if (!(await say(12, "payments-list"))) return;
      go("/summary");
      if (!(await say(13, "summary-hero"))) return;

      focusNow(undefined);
      if (!(await say(14))) return;
      endCardRef.current = true;
      setEndCard(true);
      if (!(await say(15))) return;
      setFinished(true);
    };

    const onStart = () => {
      run().catch(() => setActive(false));
    };
    window.addEventListener(START_EVENT, onStart);
    return () => {
      window.removeEventListener(START_EVENT, onStart);
      cancelledRef.current = true;
      focused?.classList.remove("tour-focus");
    };
  }, [router]);

  // Keep the caption panel next to whatever is highlighted: below it if there's room, otherwise above it.
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    // Current (drawn) positions glide towards their targets every frame, so the caption and
    // the spotlight move smoothly and stay in step with the page as it scrolls.
    const pos = { top: NaN, left: NaN };
    const spot = { x0: NaN, y0: NaN, x1: NaN, y1: NaN };
    const glide = (current: number, target: number, k: number) => (Number.isNaN(current) || Math.abs(target - current) < 0.5 ? target : current + (target - current) * k);
    const tick = () => {
      const panel = panelRef.current;
      const el = targetRef.current;
      if (panel) {
        const k = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0.14;
        const margin = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const nav = document.querySelector(".tabs");
        const navRect = nav?.getBoundingClientRect();
        const bottomLimit = navRect && navRect.top > vh / 2 ? navRect.top - margin : vh - margin;
        const ph = panel.offsetHeight;
        const pw = panel.offsetWidth;
        const showing = !!el && el.isConnected && !endCardRef.current;

        // Where the caption should be: beside the highlighted section, or bottom-centre when nothing is highlighted.
        let targetTop = bottomLimit - ph;
        let targetLeft = (vw - pw) / 2;
        if (showing) {
          const r = el.getBoundingClientRect();
          targetTop = r.bottom + margin;
          if (targetTop + ph > bottomLimit) targetTop = r.top - ph - margin;
          if (targetTop < margin) targetTop = Math.min(bottomLimit - ph, Math.max(margin, r.bottom - ph - margin));
          targetLeft = Math.min(Math.max(r.left, margin), Math.max(margin, vw - pw - margin));

          const pad = 8;
          spot.x0 = glide(spot.x0, Math.max(0, r.left - pad), k);
          spot.y0 = glide(spot.y0, Math.max(0, r.top - pad), k);
          spot.x1 = glide(spot.x1, Math.min(vw, r.right + pad), k);
          spot.y1 = glide(spot.y1, Math.min(vh, r.bottom + pad), k);
          const boxes = [
            [0, 0, vw, spot.y0],
            [0, spot.y1, vw, Math.max(0, vh - spot.y1)],
            [0, spot.y0, spot.x0, Math.max(0, spot.y1 - spot.y0)],
            [spot.x1, spot.y0, Math.max(0, vw - spot.x1), Math.max(0, spot.y1 - spot.y0)],
          ];
          shadeRefs.current.forEach((shade, i) => {
            if (!shade) return;
            const [x, y, w, h] = boxes[i];
            shade.style.transform = `translate(${x}px, ${y}px)`;
            shade.style.width = `${w}px`;
            shade.style.height = `${h}px`;
            shade.dataset.on = "true";
          });
        } else {
          shadeRefs.current.forEach((shade) => {
            if (shade) shade.dataset.on = "false";
          });
        }

        pos.top = glide(pos.top, targetTop, k);
        pos.left = glide(pos.left, targetLeft, k);
        panel.dataset.floating = "true";
        panel.style.top = `${pos.top.toFixed(1)}px`;
        panel.style.left = `${pos.left.toFixed(1)}px`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const stop = () => {
    cancelledRef.current = true;
    window.__chronoTourAudio?.pause();
    document.querySelectorAll(".tour-focus").forEach((el) => el.classList.remove("tour-focus"));
    setEndCard(false);
    setActive(false);
  };

  if (!active) return null;
  return (
    <>
      {endCard && (
        <div className="tour-endcard" aria-hidden="true">
          <div className="tour-endcard-mark">
            <span className="tour-endcard-ring" />
            Chrono
          </div>
          <p className="tour-endcard-tag">Know before you commit.</p>
          <p className="tour-endcard-by">BinaryBros</p>
        </div>
      )}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="tour-shade"
          data-on="false"
          aria-hidden="true"
          ref={(el) => {
            shadeRefs.current[i] = el;
          }}
        />
      ))}
      <div className="autotour" role="region" aria-label="Narrated tour" ref={panelRef} data-floating="false">
        <div className="autotour-progress" aria-hidden="true">
          <span style={{ width: `${finished ? 100 : (clip / CLIP_SECONDS.length) * 100}%` }} />
        </div>
        <p className="autotour-caption" aria-live="polite">
          {finished ? "That's Chrono. Explore Lerato's business yourself: it's your own private demo copy." : clip ? CLIP_LABELS[clip - 1] : "Starting the tour…"}
        </p>
        <div className="autotour-actions">
          {!finished && (
            <button type="button" className="autotour-btn" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>
              {muted ? "Sound on" : "Mute"}
            </button>
          )}
          <button type="button" className="autotour-btn autotour-stop" onClick={stop}>
            {finished ? "Close" : "Stop tour"}
          </button>
        </div>
      </div>
    </>
  );
}

/** A page hands the tour its steps, built from that page's real numbers. */
export function TourScene({ name, steps }: { name: string; steps: TourScriptStep[] }) {
  useEffect(() => {
    window.__chronoTourScenes = { ...(window.__chronoTourScenes ?? {}), [name]: steps };
  }, [name, steps]);
  return null;
}

/** Starts the tour. The tap also unlocks audio playback (needed on phones). */
export function AutoTourButton({ className = "btn btn-wide autotour-start", label = "▶ Watch a 90-second tour" }: { className?: string; label?: string }) {
  const start = () => {
    try {
      const audio = tourAudio();
      audio.muted = true;
      audio.src = "/tour-audio/clip_1.mp3";
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
    } catch {
      // No audio: the tour still runs with captions.
    }
    window.dispatchEvent(new Event(START_EVENT));
  };
  return (
    <button type="button" className={className} onClick={start}>
      {label}
    </button>
  );
}
