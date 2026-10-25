import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { isLatePayer, reliabilityTone, summarizeCustomers } from "@/lib/data/insights";
import { todayInJohannesburg } from "@/lib/engine";
import { ReliabilityRing } from "@/components/Reliability";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { business } = await requireBusiness();
  const ctx = await createRepo(prisma).loadContext(business, todayInJohannesburg());
  const customers = summarizeCustomers(ctx).sort((a, b) => b.reliability.shiftDays - a.reliability.shiftDays || a.name.localeCompare(b.name));
  const late = customers.filter((c) => isLatePayer(c.reliability)).length;

  return (
    <main className="page-narrow">
      <h1 className="h1">Customers</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        How each customer really pays, learned from the payments you record. Chrono uses this in every forecast.
      </p>
      {customers.length > 0 && (
        <div className="stat-row">
          <div className="stat">
            <span className="stat-value num">{customers.length}</span>
            <span className="small muted">customers</span>
          </div>
          <div className="stat">
            <span className="stat-value num" style={{ color: late ? "var(--tight)" : "var(--safe)" }}>
              {late}
            </span>
            <span className="small muted">usually pay late</span>
          </div>
        </div>
      )}
      {customers.length === 0 ? (
        <div className="empty">
          <p style={{ margin: 0, fontWeight: 700 }}>No customers yet</p>
          <p className="small muted" style={{ margin: "0.25rem 0 0.9rem" }}>
            Customers are added when you check an order. Once you record their payments, Chrono learns how they pay.
          </p>
          <Link href="/orders/new" className="btn">
            Check an order
          </Link>
        </div>
      ) : (
        <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }} data-tour="customers-list">
          {customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`} className="row customer-row">
              <ReliabilityRing onTimeRate={c.reliability.onTimeRate} hasHistory={c.reliability.scope === "CUSTOMER"} />
              <span className="customer-main">
                <strong>{c.name}</strong>
                <span className={`badge ${reliabilityTone(c.reliability)}`}>{c.summary}</span>
              </span>
              <span className="small muted num">
                {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
