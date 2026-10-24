import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { commitmentRowToInput } from "@/lib/data/convert";
import { formatRand, formatShortDate, todayInJohannesburg } from "@/lib/engine";
import { addCommitment, removeCommitment } from "@/app/actions/commitments";

export const dynamic = "force-dynamic";

const REPEAT_LABEL = { NONE: "Once", WEEKLY: "Every week", MONTHLY: "Every month" } as const;

export default async function CommitmentsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { business } = await requireBusiness();
  const { error } = await searchParams;
  const rows = await createRepo(prisma).listCommitments(business.id);
  const commitments = rows.map(commitmentRowToInput);
  const today = todayInJohannesburg();

  return (
    <main>
      <h1 className="h1">Regular payments</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Rent, stock, transport, data, loan repayments, or money you expect in. Chrono counts these in every order check.
      </p>

      {commitments.length === 0 ? (
        <p className="muted">Nothing added yet. Start with rent or your biggest regular cost.</p>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {commitments.map((c) => (
            <div key={c.id} className="row">
              <span>
                <strong>{c.description}</strong>
                <br />
                <span className="small muted">
                  {REPEAT_LABEL[c.recurrence]}, from {formatShortDate(c.startDate)}
                  {c.endDate ? ` until ${formatShortDate(c.endDate)}` : ""}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong className="num" style={{ color: c.direction === "IN" ? "var(--safe)" : "var(--ink)" }}>
                  {c.direction === "IN" ? "+" : "−"}
                  {formatRand(c.amountCents)}
                </strong>
                <form action={removeCommitment}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="linkish" type="submit" aria-label={`Remove ${c.description}`}>
                    Remove
                  </button>
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
        <button className="btn btn-wide" type="submit">
          Add payment
        </button>
      </form>
    </main>
  );
}
