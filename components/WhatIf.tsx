"use client";

import { useMemo, useState } from "react";
import { applyTerms } from "@/app/actions/records";
import { forecastInputFor, type BusinessContext } from "@/lib/data/repo";
import { analyzeOrder, formatRand, formatShortDate, parseRandInput, withDeposit, type OrderInput, type Verdict } from "@/lib/engine";
import { VerdictBadge } from "./Verdict";
import { SubmitButton } from "@/components/SubmitButton";

interface Scenario {
  label: string;
  depositCents: number;
  balanceDate: string | null;
  verdict: Verdict;
  lowCents: number;
  lowDate: string;
}

/** Try different deposits and balance dates and compare them side by side. */
export function WhatIf({ ctx, order, recommendedCents, canApply }: { ctx: BusinessContext; order: OrderInput; recommendedCents: number | null; canApply: boolean }) {
  const currentDeposit = order.payments.filter((p) => p.kind === "DEPOSIT").reduce((s, p) => s + p.amountCents, 0);
  const currentBalanceDate = order.payments.find((p) => p.kind !== "DEPOSIT")?.expectedDate ?? "";
  const [depositText, setDepositText] = useState(String(Math.round((recommendedCents ?? currentDeposit) / 100)));
  const [balanceDate, setBalanceDate] = useState(currentBalanceDate);

  const run = (label: string, depositCents: number, date: string | null): Scenario | null => {
    if (depositCents < 0 || depositCents > order.valueCents) return null;
    let candidate = withDeposit(order, depositCents, ctx.today);
    if (date) candidate = { ...candidate, payments: candidate.payments.map((p) => (p.kind === "DEPOSIT" ? p : { ...p, expectedDate: date, dateCertainty: p.dateCertainty === "UNKNOWN" ? "ESTIMATED" : p.dateCertainty })) };
    try {
      const a = analyzeOrder(forecastInputFor(ctx, { ...candidate, status: "DRAFT" }));
      return { label, depositCents, balanceDate: date, verdict: a.primary.verdict, lowCents: a.primary.minBalanceCents, lowDate: a.primary.minBalanceDate };
    } catch {
      return null;
    }
  };

  const yourDeposit = parseRandInput(depositText);
  const scenarios = useMemo(() => {
    const list: (Scenario | null)[] = [run("As planned", currentDeposit, currentBalanceDate || null)];
    if (recommendedCents !== null && recommendedCents !== currentDeposit) list.push(run("Chrono's fix", recommendedCents, currentBalanceDate || null));
    if (yourDeposit !== null) list.push(run("Your idea", yourDeposit, balanceDate || null));
    return list.filter((s): s is Scenario => s !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositText, balanceDate, recommendedCents]);

  return (
    <section className="panel" id="what-if">
      <h2 className="h2" style={{ marginTop: 0 }}>
        What if you changed the terms?
      </h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="wi-deposit">Deposit (R)</label>
          <input className="input num" id="wi-deposit" inputMode="decimal" value={depositText} onChange={(e) => setDepositText(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="wi-date">Balance paid on</label>
          <input className="input" id="wi-date" type="date" value={balanceDate} onChange={(e) => setBalanceDate(e.target.value)} />
        </div>
      </div>
      {yourDeposit !== null && yourDeposit > order.valueCents && <p className="warn">The deposit can&apos;t be more than the order value ({formatRand(order.valueCents)}).</p>}

      <div className="compare">
        {scenarios.map((s) => (
          <div key={s.label} className="compare-col">
            <p className="small" style={{ margin: 0, fontWeight: 700 }}>
              {s.label}
            </p>
            <p className="small muted" style={{ margin: "0.15rem 0 0.5rem" }}>
              <span className="num">{formatRand(s.depositCents)}</span> deposit
              {s.balanceDate ? <>, balance {formatShortDate(s.balanceDate)}</> : null}
            </p>
            <VerdictBadge verdict={s.verdict} />
            <p className="small" style={{ margin: "0.5rem 0 0" }}>
              Lowest <strong className="num">{formatRand(s.lowCents)}</strong>
              <br />
              <span className="muted">{formatShortDate(s.lowDate)}</span>
            </p>
          </div>
        ))}
      </div>

      {canApply && yourDeposit !== null && yourDeposit <= order.valueCents && (
        <form action={applyTerms} style={{ marginTop: "1rem" }}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="deposit" value={String(yourDeposit / 100)} />
          <input type="hidden" name="balanceDate" value={balanceDate} />
          <SubmitButton className="btn btn-quiet btn-wide" pendingLabel="Saving…">Use your idea as the order&apos;s terms</SubmitButton>
        </form>
      )}
    </section>
  );
}
