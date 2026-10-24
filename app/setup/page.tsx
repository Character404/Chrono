import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { setupBusiness } from "@/app/actions/setup";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const existing = await prisma.business.findUnique({ where: { userId: user.id } });
  if (existing) redirect("/home");
  const { error } = await searchParams;

  return (
    <main className="shell" style={{ paddingTop: "2.5rem" }}>
      <h1 className="h1">Tell Chrono about your business</h1>
      <p className="muted">This is the starting point for every forecast. You can add rent and other regular payments next.</p>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <form action={setupBusiness} className="panel">
        <div className="field">
          <label htmlFor="name">Business name</label>
          <input className="input" id="name" name="name" required maxLength={80} placeholder="Lerato's Kitchen" />
        </div>
        <div className="field">
          <label htmlFor="type">What you do and where</label>
          <input className="input" id="type" name="type" maxLength={80} placeholder="Catering, Soshanguve" />
        </div>
        <div className="field">
          <label htmlFor="cash">Cash the business has today (R)</label>
          <input className="input num" id="cash" name="cash" inputMode="decimal" required placeholder="4500" />
          <span className="hint">Money in your account and cash on hand that you can use for the business.</span>
        </div>
        <div className="field">
          <label htmlFor="buffer">Safety buffer (R)</label>
          <input className="input num" id="buffer" name="buffer" inputMode="decimal" defaultValue="500" />
          <span className="hint">The least you want to keep in the business at all times. Chrono warns you when an order takes you below it.</span>
        </div>
        <button className="btn btn-wide" type="submit">
          Save and continue
        </button>
      </form>
    </main>
  );
}
