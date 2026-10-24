import Link from "next/link";
import { demoLogin, login } from "@/app/actions/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="shell" style={{ paddingTop: "2.5rem" }}>
      <span className="wordmark">
        <span className="wordmark-dot" aria-hidden="true" />
        Chrono
      </span>
      <h1 className="h1" style={{ marginTop: "1.5rem" }}>
        Know before you commit.
      </h1>
      <p className="muted">Check whether you can afford an order before you say yes: when you&apos;d run short, by how much, and the deposit that keeps you safe.</p>

      <form action={demoLogin} style={{ margin: "1.75rem 0" }}>
        <button className="btn btn-wide" type="submit">
          Try the demo
        </button>
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
          <button className="btn btn-quiet btn-wide" type="submit">
            Log in
          </button>
        </form>
        <p className="small muted" style={{ marginBottom: 0 }}>
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
