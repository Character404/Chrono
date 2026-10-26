import type { MonthSummary } from "@/lib/data/monthly-summary";
import { formatRand } from "@/lib/engine";

/** The monthly summary laid out like its printed page, for the on-screen print preview. */
export function SummaryPaper({ summary: s, businessName, monthName }: { summary: MonthSummary; businessName: string; monthName: string }) {
  const money = (cents: number, sign: "+" | "−") => `${sign}${formatRand(Math.abs(cents))}`;
  return (
    <div className="doc-paper">
      <div className="doc-paper-head">
        <span>
          <strong>{businessName}</strong>
          <span className="doc-paper-sub">{monthName}</span>
        </span>
        <span className="doc-paper-title">Monthly summary</span>
      </div>
      <div className="doc-paper-body">
        <div className="doc-paper-rows" style={{ marginTop: 0 }}>
          <div className="doc-paper-row" data-strong="true">
            <span>Money in</span>
            <span className="num">{money(s.moneyInCents + s.regularInCents, "+")}</span>
          </div>
          <div className="doc-paper-row">
            <span>Order costs</span>
            <span className="num">{money(s.orderCostsCents, "−")}</span>
          </div>
          <div className="doc-paper-row">
            <span>Regular payments</span>
            <span className="num">{money(s.regularOutCents, "−")}</span>
          </div>
          <div className="doc-paper-row" data-strong="true">
            <span>Left over</span>
            <span className="num">{s.netCents < 0 ? money(s.netCents, "−") : formatRand(s.netCents)}</span>
          </div>
        </div>
        <p className="doc-paper-note">Orders paid in full: {s.ordersPaidInFull.length}</p>
        <p className="doc-paper-sub">Made with Chrono</p>
      </div>
    </div>
  );
}
