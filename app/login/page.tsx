import Link from "next/link";
import { demoLogin, login } from "@/app/actions/auth";
import { CashChart } from "@/components/CashChart";
import type { DayPoint } from "@/lib/engine";
import { SubmitButton } from "@/components/SubmitButton";

/** A made-up month for the hero graphic: looks fine, then dips below R0 before a late payment lands. */
function heroSeries(): DayPoint[] {
  const shape = [42, 46, 44, 30, 22, 25, 18, 9, 4, -6, -9, -4, 12, 38, 40, 36, 44, 41, 39, 46, 50, 48, 52, 49];
  return shape.map((v, i) => ({
    date: `2026-11-${String(i + 1).padStart(2, "0")}`,
    inCents: 0,
    outCents: 0,
    balanceAfterOutCents: v * 10000,
    balanceEndCents: v * 10000,
  }));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="shell" style={{ paddingTop: "2.5rem" }}>
      <span className="wordmark">
        <span className="wordmark-dot" aria-hidden="true" />
        Chrono
      </span>
      <section className="auth-hero">
        <h1 className="h1" style={{ margin: 0 }}>
          Know before you commit.
        </h1>
        <p style={{ margin: "0.6rem 0 0.9rem", color: "rgba(238,246,245,0.78)" }}>
          See whether you can afford an order before you say yes: when you&apos;d run short, by how much, and the deposit that keeps you safe.
        </p>
        <CashChart id="auth" series={heroSeries()} bufferCents={50000} compact onDark />
      </section>

      <form action={demoLogin} style={{ margin: "0 0 1.75rem" }}>
        <SubmitButton className="btn btn-wide" pendingLabel="Opening the demo…">Try the demo</SubmitButton>
        <p className="hint" style={{ marginTop: "0.5rem" }}>
          Opens Lerato&apos;s Kitchen, a catering business in Soshanguve, with four months of real-looking history.
        </p>
      </form>

      <section className="panel">
        <h2 className="h2" style={{ marginTop: 0 }}>
          Log in
        </h2>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <form action={login}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
          </div>
          <SubmitButton className="btn btn-quiet btn-wide" pendingLabel="Logging in…">Log in</SubmitButton>
        </form>
        <p className="small muted" style={{ marginBottom: 0 }}>
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
