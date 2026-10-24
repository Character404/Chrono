import Link from "next/link";
import { signup } from "@/app/actions/auth";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="shell" style={{ paddingTop: "2.5rem" }}>
      <Link href="/login" className="wordmark">
        <span className="wordmark-dot" aria-hidden="true" />
        Chrono
      </Link>
      <h1 className="h1" style={{ marginTop: "1.5rem" }}>
        Create your account
      </h1>
      <p className="muted">Free to start. Your business data is private to you.</p>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <form action={signup} className="panel">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <span className="hint">At least 8 characters.</span>
        </div>
        <button className="btn btn-wide" type="submit">
          Create account
        </button>
      </form>
      <p className="small muted">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
