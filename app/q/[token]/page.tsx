import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { orderRowToInput } from "@/lib/data/convert";
import { formatRand, formatShortDate } from "@/lib/engine";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

/** Public, read-only quote. Shows only business name, order, total, deposit and dates. */
export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const share = await prisma.quoteShare.findFirst({
    where: { token, revokedAt: null },
    include: { order: { include: { payments: true, costs: true, business: { select: { name: true } } } } },
  });
  if (!share || share.order.status === "DECLINED" || share.order.status === "CANCELLED") notFound();

  const order = orderRowToInput(share.order);
  const deposit = order.payments.find((p) => p.kind === "DEPOSIT");
  const others = order.payments.filter((p) => p.kind !== "DEPOSIT");

  return (
    <main className="shell" style={{ paddingTop: "2.5rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        Quote from
      </p>
      <h1 className="h1" style={{ marginTop: "0.1rem" }}>
        {share.order.business.name}
      </h1>

      <section className="panel" style={{ marginTop: "1.25rem" }}>
        <p className="label" style={{ margin: 0 }}>
          {order.title}
        </p>
        <p className="big-number num" style={{ margin: "0.5rem 0" }}>
          {formatRand(order.valueCents)}
        </p>
        <div className="rows">
          {deposit && (
            <div className="row">
              <span>
                <strong>Deposit to confirm the order</strong>
                <br />
                <span className="small muted">{deposit.expectedDate ? `By ${formatShortDate(deposit.expectedDate)}` : "When you confirm"}</span>
              </span>
              <strong className="num">{formatRand(deposit.amountCents)}</strong>
            </div>
          )}
          {others.map((p) => (
            <div key={p.id} className="row">
              <span>
                {p.kind === "BALANCE" ? "Balance" : "Instalment"}
                <br />
                <span className="small muted">{p.expectedDate ? `Due ${formatShortDate(p.expectedDate)}` : "Date to be agreed"}</span>
              </span>
              <span className="num">{formatRand(p.amountCents)}</span>
            </div>
          ))}
        </div>
      </section>
      <p className="small muted" style={{ marginTop: "1.5rem" }}>
        Sent with Chrono. Questions about this quote? Reply to the person who sent it.
      </p>
    </main>
  );
}
