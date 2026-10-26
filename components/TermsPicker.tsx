"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Choose an item and a date, then see the terms. Moves to the terms without reloading the page,
 * so it's quick, and the narrated tour keeps running. The item field always follows the item
 * chosen on the menu cards above.
 */
export function TermsPicker({ slug, options, item, date, minDates }: { slug: string; options: { id: string; label: string }[]; item?: string; date?: string; minDates: Record<string, string> }) {
  const router = useRouter();
  const [selected, setSelected] = useState(item ?? "");
  const [pending, start] = useTransition();
  const fallbackMin = Object.values(minDates).sort()[0];

  // When "Choose" is tapped on a menu card, the page's item changes: show it here, and bring the form into view.
  useEffect(() => {
    if (!item) return;
    setSelected(item);
    if (window.location.hash === "#order") {
      document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [item]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const it = (form.elements.namedItem("item") as HTMLSelectElement).value;
    const dt = (form.elements.namedItem("date") as HTMLInputElement).value;
    if (!it || !dt) return;
    start(() => router.push(`/shop/${slug}?item=${encodeURIComponent(it)}&date=${encodeURIComponent(dt)}`, { scroll: false }));
  };

  return (
    <form onSubmit={submit} className="order-pick">
      <div className="field">
        <label htmlFor="item">What would you like?</label>
        <select className="input" id="item" name="item" value={selected} required onChange={(e) => setSelected(e.target.value)}>
          <option value="" disabled>
            Choose an item
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="date">When do you need it?</label>
        <input className="input" id="date" name="date" type="date" min={minDates[selected] ?? fallbackMin} defaultValue={date ?? ""} required />
      </div>
      <button className="btn btn-outline btn-wide" type="submit" data-tour="see-terms" disabled={pending} aria-busy={pending}>
        {pending && <span className="spinner" aria-hidden="true" style={{ display: "inline-block", width: "1em", height: "1em" }} />}
        {pending ? "Checking" : "See my terms"}
      </button>
    </form>
  );
}
