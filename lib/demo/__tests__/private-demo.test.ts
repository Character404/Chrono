import { describe, expect, it } from "vitest";
import { analyzeOrder } from "../../engine/analyze";
import { buildDemoData, DEMO_IDS, demoWeddingInput, isDemoRecord, prefixDemoData } from "../demo-data";

describe("Private demo copies", () => {
  const today = "2026-10-24";
  const base = buildDemoData(today);
  const a = prefixDemoData(base, "aaa111_");
  const b = prefixDemoData(base, "bbb222_");

  it("gives every record a unique id per visitor", () => {
    const idsA = [...a.customers.map((c) => c.id), ...a.orders.map((o) => o.id), ...a.commitments.map((c) => c.id)];
    const idsB = new Set([...b.customers.map((c) => c.id), ...b.orders.map((o) => o.id), ...b.commitments.map((c) => c.id)]);
    expect(idsA.some((id) => idsB.has(id))).toBe(false);
    expect(new Set(idsA).size).toBe(idsA.length);
  });

  it("keeps orders linked to their own copy's customers", () => {
    const customerIds = new Set(a.customers.map((c) => c.id));
    expect(a.orders.every((o) => customerIds.has(o.customerId))).toBe(true);
  });

  it("still recognises the wedding order and shows the same story", () => {
    expect(a.orders.some((o) => isDemoRecord(o.id, DEMO_IDS.wedding))).toBe(true);
    expect(isDemoRecord("someone-else-order", DEMO_IDS.wedding)).toBe(false);
    const analysis = analyzeOrder(demoWeddingInput(a, today));
    expect(analysis.asEntered.verdict).toBe("SAFE");
    expect(analysis.primary.verdict).toBe("SHORTFALL");
  });
});
