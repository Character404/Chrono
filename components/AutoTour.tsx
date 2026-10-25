"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The 90-second narrated demo. It lives in the root layout, so it keeps running
 * while it moves between pages: login → sign-up → demo home → the wedding order.
 * Nothing runs unless someone taps "Watch the 90-second tour".
 */

export interface TourScriptStep {
  /** Words spoken and shown as a caption. */
  say: string;
  /** data-tour value of the element to highlight and scroll to. */
  target?: string;
  /** Open this tap-to-open section first. */
  open?: string;
}

declare global {
  interface Window {
    __chronoTourScenes?: Record<string, TourScriptStep[]>;
  }
}

const START_EVENT = "chrono-tour-start";
const PAUSE_MS = 550;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  for (const lang of ["en-ZA", "en-GB", "en-AU", "en-US"]) {
    const v = voices.find((x) => x.lang?.replace("_", "-").toLowerCase() === lang.toLowerCase());
    if (v) return v;
  }
  return voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ?? null;
}

function speak(text: string, muted: boolean): Promise<void> {
  const estimate = Math.max(1800, (text.split(/\s+/).length / 2.7) * 1000);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    if (muted || !("speechSynthesis" in window)) {
      setTimeout(finish, estimate);
      return;
    }
    const fallback = setTimeout(finish, estimate + 2500);
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 1.05;
    u.onend = () => {
      clearTimeout(fallback);
      finish();
    };
    u.onerror = () => {
      clearTimeout(fallback);
      setTimeout(finish, estimate);
    };
    window.speechSynthesis.speak(u);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(check: () => T | null | undefined | false, timeoutMs: number): Promise<T | null> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = check();
    if (v) return v as T;
    await sleep(120);
  }
  return null;
}

// Script for the pages that don't need live numbers.
// Structure (from the hackathon's "Demo without the drama" talk):
// one promise, one rehearsed route, one action with a visible result, then the boundary and next step.
const INTRO: TourScriptStep[] = [
  { target: "intro", say: "Hi, we're BinaryBros. In ninety seconds, you'll see Chrono catch a cash shortfall a business owner can't see, and fix it." },
];
const SIGNUP: TourScriptStep[] = [{ target: "signup-process", say: "Owners register their business, and in our pilot a partner verifies it." }];
const OPEN_DEMO: TourScriptStep = { target: "demo", say: "For this demo, Lerato's catering business in Soshanguve is already registered." };
const HOME: TourScriptStep[] = [{ target: "wedding", say: "Thabo wants her to cater a wedding. It's profitable, but can she afford it?" }];
const AFTER_FIX: TourScriptStep = { target: "verdict", say: "And the order is safe. She can say yes with confidence." };
const CLOSE: TourScriptStep[] = [
  { say: "Unlike notebooks, or apps like Xero that keep books after the sale, Chrono checks each order before you commit." },
  { say: "Each business sees only its own data. Next, we're piloting with founders in Soshanguve to measure how accurate it is." },
  { say: "Chrono. Know before you commit." },
];

export function TourHost() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [muted, setMuted] = useState(false);
  const cancelledRef = useRef(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
    if (muted && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [muted]);

  useEffect(() => {
    let focused: Element | null = null;
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const focus = (target?: string) => {
      focused?.classList.remove("tour-focus");
      focused = null;
      if (!target) return;
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (!el) return;
      el.classList.add("tour-focus");
      el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
      focused = el;
    };
    const totalSteps = INTRO.length + SIGNUP.length + 1 + HOME.length + 4 + 1 + CLOSE.length; // 4 order steps, 1 after the fix
    let done = 0;

    const play = async (steps: TourScriptStep[]) => {
      for (const step of steps) {
        if (cancelledRef.current) return false;
        if (step.open) {
          const fold = document.querySelector(`[data-tour="${step.open}"]`);
          if (fold instanceof HTMLDetailsElement) fold.open = true;
        }
        focus(step.target);
        setCaption(step.say);
        done += 1;
        setProgress(Math.min(1, done / totalSteps));
        await speak(step.say, mutedRef.current);
        if (cancelledRef.current) return false;
        await sleep(PAUSE_MS);
      }
      return true;
    };
    const go = async (path: string) => {
      if (window.location.pathname !== path) router.push(path);
      await waitFor(() => window.location.pathname === path, 8000);
      await sleep(500);
    };

    const run = async () => {
      cancelledRef.current = false;
      setActive(true);
      setFinished(false);
      setCaption("");
      done = 0;
      window.__chronoTourScenes = {};

      await go("/login");
      if (!(await play(INTRO))) return;
      await go("/signup");
      if (!(await play(SIGNUP))) return;
      await go("/login");

      // Open the demo while saying so.
      focus(OPEN_DEMO.target);
      setCaption(OPEN_DEMO.say);
      done += 1;
      const said = speak(OPEN_DEMO.say, mutedRef.current);
      document.querySelector<HTMLButtonElement>('[data-tour="demo"] button')?.click();
      await said;
      await waitFor(() => window.location.pathname === "/home", 20000);
      if (cancelledRef.current) return;
      await sleep(900);
      if (!(await play(HOME))) return;

      document.querySelector<HTMLAnchorElement>('a[data-tour="wedding"]')?.click();
      const scene = await waitFor(() => window.__chronoTourScenes?.order, 12000);
      if (cancelledRef.current) return;
      await sleep(1900); // let the order screen finish its own "checked" moment
      if (scene && !(await play(scene))) return;

      // The one action with a visible result: really apply Chrono's deposit and watch the verdict turn safe.
      document.querySelector<HTMLButtonElement>('[data-tour="fix"] button')?.click();
      await waitFor(() => document.querySelector(".verdict-SAFE"), 12000);
      if (cancelledRef.current) return;
      await sleep(600);
      if (!(await play([AFTER_FIX]))) return;
      if (!(await play(CLOSE))) return;

      focus(undefined);
      setProgress(1);
      setFinished(true);
      setCaption("That's Chrono. Explore Lerato's business yourself: everything here is a private demo copy.");
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

  const stop = () => {
    cancelledRef.current = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    document.querySelectorAll(".tour-focus").forEach((el) => el.classList.remove("tour-focus"));
    setActive(false);
  };

  if (!active) return null;
  return (
    <div className="autotour" role="region" aria-label="Narrated tour">
      <div className="autotour-progress" aria-hidden="true">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="autotour-caption" aria-live="polite">
        {caption || "Starting the tour…"}
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
  );
}

/** A page hands the tour its steps, built from that page's real numbers. */
export function TourScene({ name, steps }: { name: string; steps: TourScriptStep[] }) {
  useEffect(() => {
    window.__chronoTourScenes = { ...(window.__chronoTourScenes ?? {}), [name]: steps };
  }, [name, steps]);
  return null;
}

/** Starts the tour. Unlocks speech inside the tap (needed on iPhones). */
export function AutoTourButton({ className = "btn btn-wide autotour-start" }: { className?: string }) {
  const start = () => {
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const unlock = new SpeechSynthesisUtterance(" ");
        unlock.volume = 0;
        window.speechSynthesis.speak(unlock);
      }
    } catch {
      // No speech: the tour still runs with captions.
    }
    window.dispatchEvent(new Event(START_EVENT));
  };
  return (
    <button type="button" className={className} onClick={start}>
      ▶ Watch the 90-second tour
    </button>
  );
}
