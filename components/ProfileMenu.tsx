"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

/** The profile icon in the top-right corner: who's signed in, the demo switch, settings and log out. */
export function ProfileMenu({ name, email, roleLabel, view, canSwitch, isOwner }: { name: string; email: string; roleLabel: string; view: "owner" | "customer"; canSwitch: boolean; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
  return (
    <div className="profile" ref={ref}>
      <button type="button" className="profile-button" data-open={open} aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${name}`} onClick={() => setOpen((o) => !o)}>
        {initials}
      </button>
      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-who">
            <span className="profile-avatar" aria-hidden="true">
              {initials}
            </span>
            <span>
              <strong>{name}</strong>
              <span className="small muted" style={{ display: "block" }}>
                {email}
              </span>
              <span className="badge" style={{ marginTop: "0.35rem" }}>
                {roleLabel}
              </span>
            </span>
          </div>
          {canSwitch && (
            <Link href={view === "owner" ? "/shop" : "/home"} className="profile-item" role="menuitem" onClick={() => setOpen(false)}>
<svg className="profile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h11l-3-3M17 17H6l3 3" /></svg>
              <span>
                {view === "owner" ? "Switch to customer view" : "Switch to business dashboard"}
                <span className="profile-hint">{view === "owner" ? "Order as a customer" : "Back to Lerato's dashboard"}</span>
              </span>
            </Link>
          )}
          {isOwner && view === "owner" && (
            <Link href="/settings" className="profile-item" role="menuitem" onClick={() => setOpen(false)}>
<svg className="profile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
              <span>Settings</span>
            </Link>
          )}
          <form action={logout}>
            <SubmitButton className="profile-item profile-logout" pendingLabel="Logging out">
              Log out
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
