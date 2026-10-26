"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The narrated demo tour. It lives in the root layout, so it keeps running
 * while it moves between pages: login → sign-up → demo home → the wedding order.
 * Nothing runs unless someone taps "Watch the tour".
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
const CLIP_SECONDS = [6.11, 2.51, 4.21, 4.99, 11.15, 5.96, 5.88, 4.52, 5.25, 6.69, 4.44, 5.64, 4.28, 3.97, 4.36, 7.55, 4.75, 6.84, 4.21];
const CLIP_LABELS = [
  "Welcome to Chrono",
  "Register as a business or a customer",
  "Lerato's catering business in Soshanguve",
  "Her dashboard",
  "Thabo's wedding order",
  "The forecast: a potential cash shortfall",
  "Why: costs, Thabo's payments and upcoming expenses",
  "Applying the recommended deposit",
  "Shortfall resolved",
  "Quotes and invoices on WhatsApp, in English or Sepedi",
  "New order: orders placed outside Chrono",
  "Customers: payment history",
  "Payments: regular commitments",
  "Summary: view and print",
  "Customers order through Chrono",
  "Chrono sets Sipho's deposit before he orders",
  "Lerato reviews and approves",
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
  const spotRef = useRef<HTMLDivElement | null>(null);
  // While the pointer presses something, the spotlight moves to it so the press is always in the clear.
  const pressTargetRef = useRef<HTMLElement | null>(null);
  // A pointer (fingertip on phones, cursor on laptops) that travels to each button and presses it.
  const pointerElRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: NaN, y: NaN, tx: NaN, ty: NaN, visible: false });
  // The element the pointer is heading for; its live centre is the pointer's target every frame.
  const trackRef = useRef<HTMLElement | null>(null);
  // Laptops and desktops get a cursor; phones and tablets get a fingertip.
  const [pointerKind, setPointerKind] = useState<"cursor" | "touch">("touch");

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
    const go = (path: string) => {
      if (window.location.pathname !== path) router.push(path);
    };
    /** True when the whole element is on screen and not hidden behind the phone's bottom navigation. */
    const fullyVisible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      if (el.closest(".tabs")) return r.top >= 0 && r.bottom <= window.innerHeight;
      const nav = document.querySelector(".tabs");
      const navTop = nav && getComputedStyle(nav).position === "fixed" ? nav.getBoundingClientRect().top : window.innerHeight;
      return r.top >= 8 && r.bottom <= navTop - 8;
    };
    /** Resolves once the element has stopped moving (smooth scrolling has finished). */
    const settled = async (el: HTMLElement) => {
      let last = el.getBoundingClientRect().top;
      for (let i = 0; i < 20; i++) {
        await sleep(60);
        const now = el.getBoundingClientRect().top;
        if (Math.abs(now - last) < 0.5) return;
        last = now;
      }
    };

    const press = async (selector: string) => {
      const el = await waitFor(() => document.querySelector<HTMLElement>(selector), 6000);
      if (!el || cancelledRef.current) return false;
      pressTargetRef.current = el;
      const ptr = pointerRef.current;
      // Bring the button fully into view first, and wait for the scroll to finish.
      if (!fullyVisible(el)) {
        el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
        await sleep(120);
      }
      await settled(el);
      if (Number.isNaN(ptr.x)) {
        ptr.x = window.innerWidth * 0.7;
        ptr.y = window.innerHeight * 0.85;
      }
      // The pointer follows the button's live position every frame (see the animation loop),
      // so it lands exactly on it even if the page shifts.
      trackRef.current = el;
      ptr.visible = true;
      await waitFor(() => {
        const r = el.getBoundingClientRect();
        return Math.hypot(r.left + r.width / 2 - ptr.x, r.top + r.height / 2 - ptr.y) < 1.5;
      }, 1600);
      if (cancelledRef.current) return false;
      const node = pointerElRef.current;
      if (node) node.dataset.pressing = "true";
      await sleep(170);
      el.click();
      await sleep(180);
      if (node) node.dataset.pressing = "false";
      if (trackRef.current === el) trackRef.current = null;
      await sleep(350);
      if (pressTargetRef.current === el) pressTargetRef.current = null;
      return true;
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
      (window as Window & { __chronoTourActive?: boolean }).__chronoTourActive = true;
      setActive(true);
      setFinished(false);
      setEndCard(false);
      endCardRef.current = false;
      pointerRef.current = { x: NaN, y: NaN, tx: NaN, ty: NaN, visible: false };
      trackRef.current = null;
      setPointerKind(window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.innerWidth >= 900 ? "cursor" : "touch");

      const here = (path: string) => window.location.pathname === path;
      const daysFromToday = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };

      go("/login");
      await waitFor(() => here("/login"), 6000);
      if (!(await say(1, "intro"))) return;

      // Clip 2: register as a business or a customer.
      void (async () => {
        await press('a[href="/signup"].btn');
        await waitFor(() => here("/signup"), 6000);
        focusNow("role-toggle");
        await sleep(600);
        await press('[data-tour="role-customer"]');
      })();
      if (!(await say(2))) return;

      // Clip 3 plays while we tap back to login and open the demo.
      const opened = (async () => {
        await press('[data-tour="login-link"]');
        await waitFor(() => here("/login"), 6000);
        focusNow("demo");
        await press('[data-tour="demo"] button');
      })();
      if (!(await say(3))) return;
      await opened;
      await waitFor(() => here("/home"), 20000);

      // Clip 4: walk down the whole dashboard.
      void (async () => {
        for (const part of ["home-hero", "home-waiting", "home-accepted", "home-coming"]) {
          if (cancelledRef.current) return;
          focusNow(part);
          await sleep(1250);
        }
      })();
      if (!(await say(4))) return;

      // Clip 5 plays while the wedding order opens.
      void press('a[data-tour="wedding"]');
      if (!(await say(5, "summary"))) return;
      if (!(await say(6, "verdict"))) return;
      if (!(await say(7, "why"))) return;

      // Clip 8: the tap lands on "We apply it here" (about 3.5s in).
      const fix = { secondsBeforeEnd: 1.67, run: () => void press('[data-tour="fix"] button') };
      if (!(await say(8, "fix", fix))) return;
      await waitFor(() => document.querySelector(".verdict-SAFE"), 8000);
      if (!(await say(9, "verdict"))) return;

      void (async () => {
        await press('[data-tour="share"] > summary');
        await press('[data-tour="lang-nso"]');
        focusNow("doc-preview");
      })();
      if (!(await say(10))) return;

      // Clips 11 to 14: the other pages, then print the summary.
      void press('.tabs a[href="/orders/new"]');
      if (!(await say(11, "new-order"))) return;
      void press('.tabs a[href="/customers"]');
      if (!(await say(12, "customers-list"))) return;
      void press('.tabs a[href="/commitments"]');
      if (!(await say(13, "payments-list"))) return;
      void (async () => {
        await press('.tabs a[href="/summary"]');
        await waitFor(() => here("/summary"), 6000);
        focusNow("summary-hero");
        await sleep(500);
        await press('[data-tour="print-btn"]');
        focusNow("print-preview");
      })();
      if (!(await say(14))) return;

      // Clip 15: switch to the customer view and open Lerato's Kitchen.
      void (async () => {
        focusNow(undefined);
        await press(".profile-button");
        await press('a.profile-item[href="/shop"]');
        await waitFor(() => here("/shop"), 6000);
        await press('a.listing-card[href="/shop/leratos-kitchen"]');
      })();
      if (!(await say(15, "order-panel"))) return;

      // Clip 16: Sipho picks the wedding and a date; Chrono sets his terms; he places the order.
      void (async () => {
        await waitFor(() => here("/shop/leratos-kitchen"), 6000);
        const item = document.querySelector<HTMLSelectElement>("#item");
        const date = document.querySelector<HTMLInputElement>("#date");
        if (item) {
          const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
          setValue?.call(item, "wedding");
          item.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (date) date.value = daysFromToday(8);
        focusNow("order-panel");
        await press('[data-tour="see-terms"]');
        await waitFor(() => document.querySelector('[data-tour="customer-terms"]'), 8000);
        focusNow("customer-terms");
        await sleep(2400);
        await press('[data-tour="place-order"] button');
      })();
      if (!(await say(16))) return;

      // Clip 17: back to Lerato, who opens the order and approves it.
      void (async () => {
        await waitFor(() => here("/shop/orders"), 8000);
        await press(".profile-button");
        await press('a.profile-item[href="/home"]');
        await waitFor(() => here("/home"), 6000);
        focusNow("chrono-order");
        await sleep(400);
        await press('a[data-tour="chrono-order"]');
        await waitFor(() => document.querySelector('[data-tour="accept-form"]'), 8000);
        await press('[data-tour="accept-form"] button');
      })();
      if (!(await say(17))) return;

      focusNow(undefined);
      pointerRef.current.visible = false;
      if (!(await say(18))) return;
      endCardRef.current = true;
      setEndCard(true);
      if (!(await say(19))) return;
      setFinished(true);
      (window as Window & { __chronoTourActive?: boolean }).__chronoTourActive = false;
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
        const pressing = pressTargetRef.current;
        const spotEl = !endCardRef.current && pressing?.isConnected ? pressing : showing ? el : null;

        // Where the caption should be: beside the highlighted section, or bottom-centre when nothing is highlighted.
        let targetTop = bottomLimit - ph;
        let targetLeft = (vw - pw) / 2;
        if (showing) {
          const r = el.getBoundingClientRect();
          targetTop = r.bottom + margin;
          if (targetTop + ph > bottomLimit) targetTop = r.top - ph - margin;
          if (targetTop < margin) targetTop = Math.min(bottomLimit - ph, Math.max(margin, r.bottom - ph - margin));
          targetLeft = Math.min(Math.max(r.left, margin), Math.max(margin, vw - pw - margin));
        }

        // A soft oval spotlight: clear over the section (or the button being pressed), fading into the blur.
        const spotNode = spotRef.current;
        if (spotNode) {
          if (spotEl) {
            const r = spotEl.getBoundingClientRect();
            const pad = 10;
            // Sized so the whole section sits inside the fully clear part of the oval.
            const reach = Math.SQRT2 / 0.78;
            spot.x0 = glide(spot.x0, r.left + r.width / 2, k);
            spot.y0 = glide(spot.y0, r.top + r.height / 2, k);
            spot.x1 = glide(spot.x1, (r.width / 2 + pad) * reach, k);
            spot.y1 = glide(spot.y1, (r.height / 2 + pad) * reach, k);
            const mask = `radial-gradient(${spot.x1.toFixed(1)}px ${spot.y1.toFixed(1)}px at ${spot.x0.toFixed(1)}px ${spot.y0.toFixed(1)}px, transparent 78%, #000 100%)`;
            spotNode.style.maskImage = mask;
            spotNode.style.setProperty("-webkit-mask-image", mask);
            spotNode.dataset.on = "true";
          } else {
            spotNode.dataset.on = "false";
          }
        }

        const ptr = pointerRef.current;
        const pointerNode = pointerElRef.current;
        const tracked = trackRef.current;
        if (tracked?.isConnected) {
          const r = tracked.getBoundingClientRect();
          ptr.tx = r.left + r.width / 2;
          ptr.ty = r.top + r.height / 2;
        }
        if (pointerNode && !Number.isNaN(ptr.x)) {
          const pk = k === 1 ? 1 : 0.2;
          ptr.x = glide(ptr.x, ptr.tx, pk);
          ptr.y = glide(ptr.y, ptr.ty, pk);
          pointerNode.style.transform = `translate(${ptr.x.toFixed(1)}px, ${ptr.y.toFixed(1)}px)`;
          pointerNode.dataset.visible = ptr.visible && !endCardRef.current ? "true" : "false";
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
    (window as Window & { __chronoTourActive?: boolean }).__chronoTourActive = false;
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
      <div className="tour-spot" aria-hidden="true" ref={spotRef} data-on="false" />
      <div className="tour-pointer" aria-hidden="true" ref={pointerElRef} data-visible="false" data-pressing="false" data-kind={pointerKind}>
        <span className="tp-touch" />
        <svg className="tp-cursor" viewBox="0 0 24 24" width="28" height="28">
          <path d="M4 2.5l15 11.2-6.4 1.1 3.7 6.7-2.9 1.6-3.7-6.8L4.9 20.6z" fill="#0c2228" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
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
export function AutoTourButton({ className = "btn btn-wide autotour-start", label = "▶ Watch the tour" }: { className?: string; label?: string }) {
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
