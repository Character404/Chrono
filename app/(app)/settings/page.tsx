import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo, forecastInputFor } from "@/lib/data/repo";
import { forecast, formatRand, todayInJohannesburg } from "@/lib/engine";
import { deleteAccount, updateBusiness } from "@/app/actions/settings";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { business, user } = await requireBusiness();
  const { error, saved } = await searchParams;
  const ctx = await createRepo(prisma).loadContext(business, todayInJohannesburg());
  const cashToday = forecast(forecastInputFor(ctx, null)).startingBalanceCents;

  return (
    <main className="page-narrow">
      <h1 className="h1">Business settings</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        These numbers shape every forecast Chrono makes.
      </p>
      {saved && (
        <p className="success-box" role="status">
          Saved. Your forecasts now use the new settings.
        </p>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {user.isDemo && <p className="demo-flag">This is your private copy of the demo. Change anything you like: it&apos;s deleted after 24 hours.</p>}

      <form action={updateBusiness} className="panel">
        <div className="field">
          <label htmlFor="name">Business name</label>
          <input className="input" id="name" name="name" required maxLength={80} defaultValue={business.name} />
        </div>
        <div className="field">
          <label htmlFor="type">What you do and where</label>
          <input className="input" id="type" name="type" maxLength={80} defaultValue={business.type} />
        </div>

        <div className="setting-block">
          <div className="field" style={{ marginBottom: "0.5rem" }}>
            <label htmlFor="buffer">Safety buffer (R)</label>
            <input className="input num" id="buffer" name="buffer" inputMode="decimal" required defaultValue={String(business.safetyBufferCents / 100)} />
          </div>
          <p className="hint" style={{ margin: 0 }}>
            The least you want in the business at all times. Orders that take you below it are marked <strong>Tight</strong>. Use 0 if you don&apos;t want a buffer.
          </p>
        </div>

        <div className="setting-block">
          <div className="field" style={{ marginBottom: "0.5rem" }}>
            <label htmlFor="cash">Update cash on hand today (R)</label>
            <input className="input num" id="cash" name="cash" inputMode="decimal" placeholder={String(Math.round(cashToday / 100))} />
          </div>
          <p className="hint" style={{ margin: 0 }}>
            Chrono currently thinks you have <strong className="num">{formatRand(cashToday)}</strong>. If that&apos;s not right, enter the real amount and forecasts restart from today. Leave blank to keep it.
          </p>
        </div>

        <SubmitButton className="btn btn-wide" pendingLabel="Saving…">
          Save settings
        </SubmitButton>
      </form>

      <section className="panel danger-zone">
        <h2 className="h2" style={{ marginTop: 0 }}>
          Delete my account
        </h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          This permanently deletes your account and all your business data: orders, customers, payments and regular payments. It can&apos;t be undone.
        </p>
        <form action={deleteAccount}>
          <div className="field">
            <label htmlFor="confirm">Type DELETE to confirm</label>
            <input className="input" id="confirm" name="confirm" autoComplete="off" required pattern="[Dd][Ee][Ll][Ee][Tt][Ee]" />
          </div>
          <SubmitButton className="btn btn-danger btn-wide" pendingLabel="Deleting…">
            Delete my account and data
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
