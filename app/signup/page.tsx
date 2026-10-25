import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordInput } from "@/components/PasswordInput";

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
      <form action={signup} className="panel" data-tour="signup-form">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <PasswordInput id="password" name="password" autoComplete="new-password" />
          <span className="hint">At least 8 characters.</span>
        </div>
        <SubmitButton className="btn btn-wide" pendingLabel="Creating your account…">Create account</SubmitButton>
      </form>
      <section className="panel reg-process" data-tour="signup-process" style={{ marginTop: "1rem" }}>
        <p className="label" style={{ margin: 0 }}>
          How registration works
        </p>
        <ol className="reg-steps">
          <li data-step="1">
            <strong>Create your account</strong>
            <span className="small muted">An email and a strong password. That&apos;s this form.</span>
          </li>
          <li data-step="2">
            <strong>Register your business</strong>
            <span className="small muted">What the business sells, where it trades and how long it has traded.</span>
            <div className="reg-preview" aria-label="Example of the business registration details">
              <span className="reg-field">
                <span>What you sell</span>
                <b>Catering</b>
              </span>
              <span className="reg-field">
                <span>Where you trade</span>
                <b>Soshanguve</b>
              </span>
              <span className="reg-field">
                <span>Trading since</span>
                <b>2023</b>
              </span>
              <span className="reg-field">
                <span>CIPC registration</span>
                <b>e.g. 2023/123456/07</b>
              </span>
              <span className="reg-field">
                <span>Mobile number</span>
                <b>For future verification</b>
              </span>
              <span className="reg-field">
                <span>Cash today and safety cushion</span>
                <b>For your forecasts</b>
              </span>
            </div>
          </li>
          <li data-step="3">
            <strong>
              Verification <span className="badge badge-TIGHT">Planned</span>
            </strong>
            <span className="small muted">We plan to confirm businesses are real before full access, working with a bank or incubator.</span>
          </li>
          <li data-step="4">
            <strong>Check your first order</strong>
            <span className="small muted">Know before you commit.</span>
          </li>
        </ol>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Prototype: steps 2 and 3 show the process we&apos;re designing; they aren&apos;t live yet. Chrono never asks for bank logins, card details or ID numbers.
        </p>
      </section>
      <p className="small muted">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
