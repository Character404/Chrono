import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { summarizeCustomers } from "@/lib/data/insights";
import { todayInJohannesburg } from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { business } = await requireBusiness();
  const ctx = await createRepo(prisma).loadContext(business, todayInJohannesburg());
  const customers = summarizeCustomers(ctx).sort((a, b) => b.reliability.shiftDays - a.reliability.shiftDays || a.name.localeCompare(b.name));

  return (
    <main className="page-narrow">
      <h1 className="h1">Customers</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        How each customer really pays, learned from the payments you record. Chrono uses this in every forecast.
      </p>
      {customers.length === 0 ? (
        <p className="muted">No customers yet. They&apos;re added when you check an order.</p>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
          {customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`} className="row">
              <span>
                <strong>{c.name}</strong>
                <br />
                <span className="small muted">
                  {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
                </span>
              </span>
              <span className="small" style={{ textAlign: "right", fontWeight: 600, color: c.reliability.shiftDays > 0 ? "var(--tight)" : "var(--ink)" }}>
                {c.summary}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
