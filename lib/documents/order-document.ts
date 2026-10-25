/**
 * Renders a quote or invoice as a one-page A4 PDF, in English or Sepedi.
 * Pure: everything it needs is passed in, so it's easy to test.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { ISODate } from "../engine/dates";
import { formatRand } from "../engine/money";
import type { OrderInput } from "../engine/types";
import { docDate, WORDS, type DocLang } from "./i18n";

export type DocKind = "quote" | "invoice";

export interface DocumentInput {
  kind: DocKind;
  lang: DocLang;
  today: ISODate;
  businessName: string;
  businessType: string;
  customerName: string;
  order: OrderInput;
}

const INK = rgb(0.059, 0.165, 0.188);
const MUTED = rgb(0.36, 0.42, 0.44);
const LINE = rgb(0.86, 0.89, 0.89);
const GOLD = rgb(1, 0.718, 0.012);

/** The built-in PDF fonts only cover Western European characters: replace anything else. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u0160\u0161\u017D\u017E\u0152\u0153\u0178]/g, "");
}

/** A short, stable number for the document, e.g. "Q-4F7K2A". */
export function documentNumber(kind: DocKind, orderId: string): string {
  let h = 2166136261;
  for (let i = 0; i < orderId.length; i++) h = Math.imul(h ^ orderId.charCodeAt(i), 16777619) >>> 0;
  const code = h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
  return `${kind === "quote" ? "Q" : "INV"}-${code}`;
}

interface Row {
  label: string;
  detail?: string;
  amount: string;
  strong?: boolean;
}

/** The lines on the document, worked out from the order. */
export function documentRows(input: DocumentInput): { rows: Row[]; note: string } {
  const w = WORDS[input.lang];
  const o = input.order;
  const when = (d: ISODate | null | undefined) => (d ? `${w.byDate} ${docDate(d, input.lang)}` : w.dateToAgree);
  const rows: Row[] = [{ label: w.orderTotal, amount: formatRand(o.valueCents), strong: true }];

  if (input.kind === "quote") {
    for (const p of o.payments) {
      rows.push(
        p.kind === "DEPOSIT"
          ? { label: w.depositToConfirm, detail: when(p.expectedDate), amount: formatRand(p.amountCents) }
          : { label: w.balance, detail: when(p.expectedDate), amount: formatRand(p.amountCents) },
      );
    }
    return { rows, note: w.quoteNote };
  }

  const paid = o.payments.reduce((s, p) => s + (p.receivedDate ? p.receivedAmountCents ?? p.amountCents : 0), 0);
  const due = Math.max(o.valueCents - paid, 0);
  const next = o.payments
    .filter((p) => !p.receivedDate && p.expectedDate)
    .map((p) => p.expectedDate as ISODate)
    .sort()[0];
  rows.push({ label: w.paidSoFar, amount: formatRand(paid) });
  rows.push({ label: w.amountDue, detail: due > 0 ? `${w.dueBy} ${next ? docDate(next, input.lang) : w.dateToAgree}` : undefined, amount: formatRand(due), strong: true });
  return { rows, note: w.invoiceNote };
}

function text(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size: number, color = INK) {
  page.drawText(pdfSafe(value), { x, y, size, font, color });
}

function rightText(page: PDFPage, value: string, right: number, y: number, font: PDFFont, size: number, color = INK) {
  const v = pdfSafe(value);
  page.drawText(v, { x: right - font.widthOfTextAtSize(v, size), y, size, font, color });
}

export async function renderOrderDocument(input: DocumentInput): Promise<Uint8Array> {
  const w = WORDS[input.lang];
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${input.kind === "quote" ? w.quote : w.invoice} - ${input.order.title}`));
  pdf.setCreator("Chrono");
  const page = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const left = 56;
  const right = 539;

  // Header band
  page.drawRectangle({ x: 0, y: 742, width: 595.28, height: 100, color: INK });
  text(page, input.businessName, left, 800, bold, 20, rgb(1, 1, 1));
  if (input.businessType) text(page, input.businessType, left, 780, regular, 11, rgb(0.8, 0.86, 0.86));
  rightText(page, input.kind === "quote" ? w.quote : w.invoice, right, 796, bold, 22, GOLD);

  // Details
  let y = 700;
  const detail = (label: string, value: string) => {
    text(page, label, left, y, regular, 10, MUTED);
    text(page, value, left + 120, y, bold, 11);
    y -= 20;
  };
  detail(w.number, documentNumber(input.kind, input.order.id));
  detail(w.date, docDate(input.today, input.lang));
  detail(w.from, input.businessName);
  detail(w.to, input.customerName);
  detail(w.order, input.order.title);

  // Amounts
  y -= 16;
  page.drawLine({ start: { x: left, y: y + 14 }, end: { x: right, y: y + 14 }, thickness: 1, color: LINE });
  const { rows, note } = documentRows(input);
  for (const r of rows) {
    y -= 10;
    text(page, r.label, left, y, r.strong ? bold : regular, 12);
    rightText(page, r.amount, right, y, r.strong ? bold : regular, 12);
    if (r.detail) {
      y -= 16;
      text(page, r.detail, left, y, regular, 10, MUTED);
    }
    y -= 14;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: LINE });
    y -= 10;
  }

  // Note and footer
  y -= 20;
  text(page, note, left, y, bold, 12);
  y -= 22;
  text(page, `${w.paymentDetails} ${input.businessName}.`, left, y, regular, 10, MUTED);
  page.drawRectangle({ x: left, y: 60, width: 24, height: 4, color: GOLD });
  text(page, w.madeWith, left, 44, regular, 9, MUTED);

  return pdf.save();
}
