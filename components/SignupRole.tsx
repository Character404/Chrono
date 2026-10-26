"use client";

import { useState } from "react";

/** "I run a business" or "I'm a customer". Customers also give their name, so businesses know who ordered. */
export function SignupRole() {
  const [role, setRole] = useState<"OWNER" | "CUSTOMER">("OWNER");
  return (
    <>
      <div className="role-toggle" role="radiogroup" aria-label="Account type" data-tour="role-toggle">
        <label className="role-option" data-checked={role === "OWNER"} data-tour="role-owner">
          <input type="radio" name="role" value="OWNER" checked={role === "OWNER"} onChange={() => setRole("OWNER")} />
          <strong>I run a business</strong>
          <span className="small muted">Check orders before you accept them.</span>
        </label>
        <label className="role-option" data-checked={role === "CUSTOMER"} data-tour="role-customer">
          <input type="radio" name="role" value="CUSTOMER" checked={role === "CUSTOMER"} onChange={() => setRole("CUSTOMER")} />
          <strong>I&apos;m a customer</strong>
          <span className="small muted">Order from businesses on Chrono.</span>
        </label>
      </div>
      {role === "CUSTOMER" && (
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input className="input" id="name" name="name" autoComplete="name" required maxLength={60} />
        </div>
      )}
    </>
  );
}
