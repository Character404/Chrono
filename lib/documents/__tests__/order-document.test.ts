import { describe, expect, it } from "vitest";
import { documentNumber, documentRows, pdfSafe, renderOrderDocument, type DocumentInput } from "../order-document";
import { docDate } from "../i18n";
import { buildDocPreview } from "../preview";
import { buildDemoData, DEMO_IDS } from "../../demo/demo-data";

const data = buildDemoData("2026-10-24");
const wedding = data.orders.find((o) => o.id === DEMO_IDS.wedding)!;
const cake = data.orders.find((o) => o.id === DEMO_IDS.cake)!;
const base = { today: "2026-10-24", businessName: "Lerato's Kitchen", businessType: "Catering, Soshanguve", customerName: "Thabo Mokoena" };

describe("Customer documents", () => {
  it("renders a real PDF quote in English and Sepedi", async () => {
    for (const lang of ["en", "nso"] as const) {
      const bytes = await renderOrderDocument({ ...base, kind: "quote", lang, order: wedding });
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(1000);
    }
  });

  it("lists the deposit and balance on a quote", () => {
    const { rows } = documentRows({ ...base, kind: "quote", lang: "en", order: wedding } as DocumentInput);
    expect(rows.map((r) => r.amount)).toEqual(["R5 000", "R1 000", "R4 000"]);
  });

  it("shows what's been paid and what's still due on an invoice", () => {
    const { rows } = documentRows({ ...base, kind: "invoice", lang: "en", order: cake } as DocumentInput);
    expect(rows.find((r) => r.label === "Paid so far")?.amount).toBe("R300");
    expect(rows.find((r) => r.label === "Amount due")?.amount).toBe("R600");
  });

  it("writes dates in the customer's language", () => {
    expect(docDate("2026-11-02", "en")).toBe("2 November 2026");
    expect(docDate("2026-11-02", "nso")).toBe("2 Nofemere 2026");
  });

  it("keeps Sepedi letters but drops characters the PDF font can't draw", () => {
    expect(pdfSafe("Tšhaletšo −R200")).toBe("Tšhaletšo -R200");
  });

  it("previews the same content as the PDF, in either language", () => {
    const en = buildDocPreview({ ...base, kind: "quote", lang: "en", order: wedding } as DocumentInput);
    const nso = buildDocPreview({ ...base, kind: "quote", lang: "nso", order: wedding } as DocumentInput);
    expect(en.title).toBe("Quote");
    expect(nso.title).toBe("Kakanyetšo ya Theko");
    expect(en.rows.map((r) => r.amount)).toEqual(nso.rows.map((r) => r.amount));
  });

  it("numbers documents from the order", () => {
    expect(documentNumber("quote", "abc_demo-order-wedding")).toMatch(/^Q-[0-9A-Z]{6}$/);
    expect(documentNumber("invoice", "abc_demo-order-wedding")).toMatch(/^INV-[0-9A-Z]{6}$/);
    expect(documentNumber("quote", "order-1")).toBe(documentNumber("quote", "order-1"));
    expect(documentNumber("quote", "order-1")).not.toBe(documentNumber("quote", "order-2"));
  });
});
