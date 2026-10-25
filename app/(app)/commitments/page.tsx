import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { commitmentRowToInput } from "@/lib/data/convert";
import { formatRand, formatShortDate, todayInJohannesburg } from "@/lib/engine";
import { addCommitment, removeCommitment } from "@/app/actions/commitments";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

const REPEAT_LABEL = { NONE: "Once", WEEKLY: "Every week", MONTHLY: "Every month" } as const;

export default async function CommitmentsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { business } = await requireBusiness();
  const { error } = await searchParams;
  const rows = await createRepo(prisma).listCommitments(business.id);
  const commitments = rows.map(commitmentRowToInput);
  const today = todayInJohannesburg();
  // A rough monthly picture: weekly items count about 4.33 times a month, one-offs aren't included.
  const monthly = (dir: "IN" | "OUT") =>
    commitments
      .filter((c) => c.active && c.direction === dir && c.recurrence !== "NONE")
      .reduce((s, c) => s + (c.recurrence === "WEEKLY" ? Math.round((c.amountCents * 52) / 12) : c.amountCents), 0);
  const outMonthly = monthly("OUT");
  const inMonthly = monthly("IN");

  return (
    <main className="page-narrow">
      <h1 className="h1">Regular payments</h1>

      {commitments.length > 0 && (
        <div className="stat-row">
          <div className="stat">
            <span className="stat-value num">{formatRand(outMonthly)}</span>
            <span className="small muted">goes out each month</span>
          </div>
          <div className="stat">
            <span className="stat-value num" style={{ color: inMonthly ? "var(--safe)" : "var(--muted)" }}>
              {formatRand(inMonthly)}
            </span>
            <span className="small muted">comes in each month</span>
          </div>
        </div>
      )}
      {commitments.length === 0 ? (
        <div className="empty">
          <p style={{ margin: 0, fontWeight: 700 }}>No regular payments yet</p>
          <p className="small muted" style={{ margin: "0.25rem 0 0" }}>
            Start with rent or your biggest regular cost.
          </p>
        </div>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }} data-tour="payments-list">
          {commitments.map((c) => (
            <div key={c.id} className="row">
              <span style={{ display: "flex", gap: "0.7rem", alignItems: "center" }}>
                <span className={`flow-icon ${c.direction === "IN" ? "flow-in" : "flow-out"}`} aria-hidden="true">
                  {c.direction === "IN" ? "↓" : "↑"}
                </span>
                <span>
                <strong>{c.description}</strong>
                <br />
                <span className="small muted">
                  {REPEAT_LABEL[c.recurrence]}, from {formatShortDate(c.startDate)}
                  {c.endDate ? ` until ${formatShortDate(c.endDate)}` : ""}
                </span>
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong className="num" style={{ color: c.direction === "IN" ? "var(--safe)" : "var(--ink)" }}>
                  {c.direction === "IN" ? "+" : "−"}
                  {formatRand(c.amountCents)}
                </strong>
                <form action={removeCommitment}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton className="linkish" pendingLabel="Removing…" ariaLabel={`Remove ${c.description}`}>
                    Remove
                  </SubmitButton>
                </form>
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="h2">Add a regular payment</h2>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <form action={addCommitment} className="panel">
        <div className="field">
          <label htmlFor="description">What is it?</label>
          <input className="input" id="description" name="description" required maxLength={80} placeholder="Rent" />
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 1rem" }}>
          <legend className="label" style={{ marginBottom: "0.4rem" }}>
            Money in or out?
          </legend>
          <div className="choice-row">
            <label className="choice">
              <input type="radio" name="direction" value="OUT" defaultChecked /> Money out
            </label>
            <label className="choice">
              <input type="radio" name="direction" value="IN" /> Money in
            </label>
          </div>
        </fieldset>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="amount">Amount (R)</label>
            <input className="input num" id="amount" name="amount" inputMode="decimal" required placeholder="2500" />
          </div>
          <div className="field">
            <label htmlFor="recurrence">How often?</label>
            <select className="select" id="recurrence" name="recurrence" defaultValue="MONTHLY">
              <option value="NONE">Once</option>
              <option value="WEEKLY">Every week</option>
              <option value="MONTHLY">Every month</option>
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="startDate">Next due</label>
            <input className="input" id="startDate" name="startDate" type="date" required defaultValue={today} />
          </div>
          <div className="field">
            <label htmlFor="endDate">Ends (optional)</label>
            <input className="input" id="endDate" name="endDate" type="date" />
          </div>
        </div>
        <SubmitButton className="btn btn-wide" pendingLabel="Adding…">Add payment</SubmitButton>
      </form>
    </main>
  );
}
