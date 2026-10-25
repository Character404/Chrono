import { completeOrder, recordCost, recordPayment } from "@/app/actions/records";
import { diffDays, formatRand, formatShortDate, type ISODate, type OrderInput } from "@/lib/engine";
import { SubmitButton } from "@/components/SubmitButton";

function lateness(expected: ISODate | null, received: ISODate): string {
  if (!expected) return "";
  const d = diffDays(received, expected);
  if (d <= 0) return "on time";
  return `${d} day${d === 1 ? "" : "s"} late`;
}

/** Record what actually happened. Every record teaches Chrono about this business. */
export function RecordActuals({ order, today }: { order: OrderInput; today: ISODate }) {
  const settled = order.payments.every((p) => p.receivedDate) && order.costs.every((c) => c.paidDate);
  return (
    <section className="panel" id="record">
      <h2 className="h2" style={{ marginTop: 0 }}>
        Record what actually happened
      </h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        Each payment you record teaches Chrono how this customer really pays, so your next forecasts get more accurate.
      </p>

      <div className="rows">
        {order.payments.map((p) => (
          <div key={p.id} style={{ padding: "0.75rem 0" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {p.kind === "DEPOSIT" ? "Deposit" : p.kind === "BALANCE" ? "Balance" : "Instalment"}: <span className="num">{formatRand(p.amountCents)}</span>
            </p>
            {p.receivedDate ? (
              <p className="small muted" style={{ margin: 0 }}>
                Received <span className="num">{formatRand(p.receivedAmountCents ?? p.amountCents)}</span> on {formatShortDate(p.receivedDate)}
                {p.kind !== "DEPOSIT" && p.expectedDate ? `, ${lateness(p.expectedDate, p.receivedDate)}` : ""}
              </p>
            ) : (
              <form action={recordPayment} className="inline-form">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="paymentId" value={p.id} />
                <span className="small muted">Expected {p.expectedDate ? formatShortDate(p.expectedDate) : "date not set"}</span>
                <div className="grid-2">
                  <input className="input" type="date" name="date" defaultValue={today} max={today} aria-label="Date received" />
                  <input className="input num" name="amount" inputMode="decimal" defaultValue={String(p.amountCents / 100)} aria-label="Amount received (R)" />
                </div>
                <SubmitButton className="btn btn-quiet" pendingLabel="Recording…">Mark as received</SubmitButton>
              </form>
            )}
          </div>
        ))}
        {order.costs.map((c) => (
          <div key={c.id} style={{ padding: "0.75rem 0" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {c.description}: <span className="num">{formatRand(c.estimatedCents)}</span> estimated
            </p>
            {c.paidDate ? (
              <p className="small muted" style={{ margin: 0 }}>
                Paid <span className="num">{formatRand(c.paidCents ?? c.estimatedCents)}</span> on {formatShortDate(c.paidDate)}
              </p>
            ) : (
              <form action={recordCost} className="inline-form">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="costId" value={c.id} />
                <div className="grid-2">
                  <input className="input" type="date" name="date" defaultValue={today} max={today} aria-label="Date paid" />
                  <input className="input num" name="amount" inputMode="decimal" defaultValue={String(c.estimatedCents / 100)} aria-label="Amount paid (R)" />
                </div>
                <SubmitButton className="btn btn-quiet" pendingLabel="Recording…">Mark as paid</SubmitButton>
              </form>
            )}
          </div>
        ))}
      </div>

      {settled && order.status === "ACCEPTED" && (
        <form action={completeOrder} style={{ marginTop: "0.75rem" }}>
          <input type="hidden" name="orderId" value={order.id} />
          <SubmitButton className="btn btn-wide" pendingLabel="Completing…">Mark order complete</SubmitButton>
        </form>
      )}
    </section>
  );
}
