"use client";

import { useActionState, useMemo, useState } from "react";
import { saveOrder, type SaveOrderState } from "@/app/actions/orders";
import { forecastInputFor, type BusinessContext } from "@/lib/data/repo";
import {
  CATEGORY_LABEL,
  CERTAINTY_LABEL,
  COST_CATEGORIES,
  draftToOrderInput,
  validateDraft,
  validateDraftStep,
  type DraftCost,
  type OrderDraft,
} from "@/lib/data/order-draft";
import { addDays, analyzeOrder, findDuplicateCost, formatRand, parseRandInput, validateOrder, type CostCategory, type DateCertainty } from "@/lib/engine";
import { VerdictBadge } from "@/components/Verdict";
import { CashChart } from "@/components/CashChart";

interface CostForm {
  key: string;
  description: string;
  category: CostCategory;
  amount: string;
  date: string;
  notSure: boolean;
}

const NEW_CUSTOMER = "__new__";
const STEP_TITLES = ["The order", "Getting paid", "Your costs"];

let keyCounter = 1;
const nextKey = () => `c${keyCounter++}`;

export function OrderWizard({ ctx }: { ctx: BusinessContext }) {
  const today = ctx.today;
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState(ctx.customers[0]?.id ?? NEW_CUSTOMER);
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [depositText, setDepositText] = useState("");
  const [depositDate, setDepositDate] = useState(today);
  const [balanceDate, setBalanceDate] = useState(addDays(today, 7));
  const [balanceCertainty, setBalanceCertainty] = useState<DateCertainty>("ESTIMATED");
  const [costs, setCosts] = useState<CostForm[]>([
    { key: nextKey(), description: "Ingredients", category: "INGREDIENTS", amount: "", date: addDays(today, 1), notSure: false },
  ]);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState<SaveOrderState | null, FormData>(saveOrder, null);

  const valueCents = parseRandInput(value) ?? 0;
  const depositCents = parseRandInput(depositText) ?? 0;

  const draft: OrderDraft = useMemo(
    () => ({
      customerId: customer === NEW_CUSTOMER ? null : customer,
      newCustomerName: customer === NEW_CUSTOMER ? newName : null,
      title,
      valueCents: parseRandInput(value) ?? -1,
      deposit: { amountCents: parseRandInput(depositText) ?? (depositText.trim() === "" ? 0 : -1), date: depositDate },
      balance: { date: balanceCertainty === "UNKNOWN" ? null : balanceDate, certainty: balanceCertainty },
      costs: costs.map<DraftCost>((c) => ({
        key: c.key,
        description: c.description,
        category: c.category,
        amountCents: parseRandInput(c.amount) ?? -1,
        date: c.notSure ? null : c.date || null,
        certainty: c.notSure ? "UNKNOWN" : "CONFIRMED",
      })),
    }),
    [customer, newName, title, value, depositText, depositDate, balanceDate, balanceCertainty, costs],
  );

  // Live forecast: only costs with a valid amount are counted while typing.
  const analysis = useMemo(() => {
    if (valueCents <= 0 || depositCents > valueCents) return null;
    const preview: OrderDraft = { ...draft, valueCents, deposit: { ...draft.deposit, amountCents: depositCents }, costs: draft.costs.filter((c) => c.amountCents > 0) };
    const order = draftToOrderInput(preview, { id: "preview", customerId: preview.customerId ?? "new-customer" });
    if (validateOrder(order).length) return null;
    try {
      return analyzeOrder(forecastInputFor(ctx, order));
    } catch {
      return null;
    }
  }, [draft, ctx, valueCents, depositCents]);

  const engineCosts = draftToOrderInput({ ...draft, valueCents: Math.max(valueCents, 1), deposit: { ...draft.deposit, amountCents: 0 } }, { id: "dup", customerId: "x" }).costs;

  function updateCost(key: string, patch: Partial<CostForm>) {
    setCosts((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  /** Moves between steps, but only forward past steps that are filled in correctly. */
  function goToStep(target: number) {
    if (target > step) {
      for (let s = step; s < target; s++) {
        const stepErrors = validateDraftStep(draft, s);
        if (stepErrors.length) {
          setClientErrors(stepErrors);
          setStep(s);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }
    }
    setClientErrors([]);
    setStep(target);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const errors = validateDraft(draft);
    setClientErrors(errors);
    if (errors.length) e.preventDefault();
  }

  const errors = clientErrors.length ? clientErrors : state?.errors ?? [];

  return (
    <form action={formAction} onSubmit={onSubmit}>
      <input type="hidden" name="draft" value={JSON.stringify(draft)} />

      <div className="steps" aria-hidden="true">
        {STEP_TITLES.map((t, i) => (
          <span key={t} data-done={i <= step} />
        ))}
      </div>
      <p className="small muted" style={{ margin: "0 0 0.25rem" }}>
        Step {step + 1} of 3
      </p>
      <h2 className="h2" style={{ marginTop: 0 }}>
        {STEP_TITLES[step]}
      </h2>

      {errors.length > 0 && (
        <div className="error-box" role="alert">
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {step === 0 && (
        <>
          <div className="field">
            <label htmlFor="customer">Customer</label>
            <select className="select" id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)}>
              {ctx.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CUSTOMER}>+ New customer</option>
            </select>
          </div>
          {customer === NEW_CUSTOMER && (
            <div className="field">
              <label htmlFor="newName">New customer&apos;s name</label>
              <input className="input" id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} placeholder="Thabo Mokoena" />
            </div>
          )}
          <div className="field">
            <label htmlFor="title">What&apos;s the order?</label>
            <input className="input" id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Wedding catering" />
          </div>
          <div className="field">
            <label htmlFor="value">Total the customer will pay (R)</label>
            <input className="input num" id="value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="5000" />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="deposit">Deposit (R)</label>
              <input className="input num" id="deposit" inputMode="decimal" value={depositText} onChange={(e) => setDepositText(e.target.value)} placeholder="1000" />
            </div>
            <div className="field">
              <label htmlFor="depositDate">Deposit paid on</label>
              <input className="input" id="depositDate" type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
            </div>
          </div>
          <p style={{ margin: "0 0 1rem" }}>
            Balance after the deposit:{" "}
            <strong className="num">{valueCents > 0 ? formatRand(Math.max(valueCents - depositCents, 0)) : "enter the total first"}</strong>
          </p>
          <div className="field">
            <label htmlFor="balanceDate">When will the customer pay the balance?</label>
            <input
              className="input"
              id="balanceDate"
              type="date"
              value={balanceDate}
              disabled={balanceCertainty === "UNKNOWN"}
              onChange={(e) => setBalanceDate(e.target.value)}
            />
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: "0 0 1rem" }}>
            <legend className="label" style={{ marginBottom: "0.4rem" }}>
              How sure is that date?
            </legend>
            <div className="choice-row">
              {(["CONFIRMED", "ESTIMATED", "UNKNOWN"] as DateCertainty[]).map((c) => (
                <label key={c} className="choice">
                  <input type="radio" name="balanceCertainty" value={c} checked={balanceCertainty === c} onChange={() => setBalanceCertainty(c)} />
                  {CERTAINTY_LABEL[c]}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {step === 2 && (
        <>
          {costs.map((c, i) => {
            const engineCost = engineCosts[i];
            const duplicate = engineCost && engineCost.estimatedCents > 0 ? findDuplicateCost(engineCosts.filter((x) => x.id !== engineCost.id), engineCost) : null;
            return (
              <div key={c.key} className="cost-row">
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor={`${c.key}-desc`}>What is it?</label>
                    <input className="input" id={`${c.key}-desc`} value={c.description} maxLength={80} onChange={(e) => updateCost(c.key, { description: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor={`${c.key}-cat`}>Type</label>
                    <select className="select" id={`${c.key}-cat`} value={c.category} onChange={(e) => updateCost(c.key, { category: e.target.value as CostCategory })}>
                      {COST_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABEL[cat]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor={`${c.key}-amt`}>Amount (R)</label>
                    <input className="input num" id={`${c.key}-amt`} inputMode="decimal" value={c.amount} onChange={(e) => updateCost(c.key, { amount: e.target.value })} placeholder="3200" />
                  </div>
                  <div className="field">
                    <label htmlFor={`${c.key}-date`}>Pay by</label>
                    <input className="input" id={`${c.key}-date`} type="date" value={c.date} disabled={c.notSure} onChange={(e) => updateCost(c.key, { date: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <label className="choice">
                    <input type="checkbox" checked={c.notSure} onChange={(e) => updateCost(c.key, { notSure: e.target.checked })} />
                    Not sure of the date
                  </label>
                  {costs.length > 1 && (
                    <button type="button" className="linkish" onClick={() => setCosts((list) => list.filter((x) => x.key !== c.key))}>
                      Remove
                    </button>
                  )}
                </div>
                {duplicate && (
                  <p className="warn">This looks the same as another cost ({duplicate.description}). Remove one if you entered it twice.</p>
                )}
                {c.notSure && <p className="hint">Chrono will count this cost as due today, to be safe.</p>}
              </div>
            );
          })}
          <button
            type="button"
            className="btn btn-quiet btn-wide"
            onClick={() => setCosts((list) => [...list, { key: nextKey(), description: "", category: "OTHER", amount: "", date: addDays(today, 1), notSure: false }])}
          >
            Add another cost
          </button>
        </>
      )}

      <div className="grid-2" style={{ marginTop: "1.5rem" }}>
        {step > 0 ? (
          <button type="button" className="btn btn-quiet" onClick={() => goToStep(step - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <button type="button" className="btn" onClick={() => goToStep(step + 1)}>
            Next
          </button>
        ) : (
          <button type="submit" className="btn" disabled={pending} aria-busy={pending}>
            {pending && <span className="spinner" aria-hidden="true" />}
            {pending ? "Saving…" : "Save and see the result"}
          </button>
        )}
      </div>

      <div className="live-bar" aria-live="polite">
        {analysis ? (
          <div className="live-row">
            <div>
              <div key={analysis.primary.verdict} className="pop">
                <VerdictBadge verdict={analysis.primary.verdict} />
              </div>
              <p className="small" style={{ margin: "0.3rem 0 0", fontWeight: 600 }}>
                {analysis.explanation.headline}
              </p>
            </div>
            <CashChart key={`${analysis.primary.minBalanceCents}-${analysis.primary.series.length}`} id="live" series={analysis.primary.series} bufferCents={ctx.business.safetyBufferCents} compact />
          </div>
        ) : (
          <span className="small muted">Enter the total and deposit to see whether you can afford this order.</span>
        )}
      </div>
    </form>
  );
}
