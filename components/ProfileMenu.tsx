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
      <button type="button" className="profile-button" aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${name}`} onClick={() => setOpen((o) => !o)}>
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
              {view === "owner" ? "Switch to customer view" : "Switch to business dashboard"}
            </Link>
          )}
          {isOwner && view === "owner" && (
            <Link href="/settings" className="profile-item" role="menuitem" onClick={() => setOpen(false)}>
              Settings
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
