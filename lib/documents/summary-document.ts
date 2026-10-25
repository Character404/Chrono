/** Renders the monthly summary as a one-page A4 PDF, in English or Sepedi. */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { MonthSummary } from "../data/monthly-summary";
import { formatRand } from "../engine/money";
import { WORDS, type DocLang } from "./i18n";
import { pdfSafe } from "./order-document";

const INK = rgb(0.059, 0.165, 0.188);
const MUTED = rgb(0.36, 0.42, 0.44);
const LINE = rgb(0.86, 0.89, 0.89);
const GOLD = rgb(1, 0.718, 0.012);
const GREEN = rgb(0.043, 0.478, 0.341);
const RED = rgb(0.784, 0.118, 0.263);

export function monthTitle(month: string, lang: DocLang): string {
  const [y, m] = month.split("-").map(Number);
  return `${WORDS[lang].months[m - 1]} ${y}`;
}

export async function renderSummaryDocument(input: { summary: MonthSummary; lang: DocLang; businessName: string; businessType: string }): Promise<Uint8Array> {
  const { summary: s, lang } = input;
  const w = WORDS[lang];
  const sw = w.summary;
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${sw.title} - ${monthTitle(s.month, lang)}`));
  pdf.setCreator("Chrono");
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const left = 56;
  const right = 539;
  const t = (v: string, x: number, y: number, f = regular, size = 11, color = INK) => page.drawText(pdfSafe(v), { x, y, size, font: f, color });
  const r = (v: string, y: number, f = regular, size = 11, color = INK) => {
    const safe = pdfSafe(v);
    page.drawText(safe, { x: right - f.widthOfTextAtSize(safe, size), y, size, font: f, color });
  };

  page.drawRectangle({ x: 0, y: 742, width: 595.28, height: 100, color: INK });
  t(input.businessName, left, 800, bold, 20, rgb(1, 1, 1));
  if (input.businessType) t(input.businessType, left, 780, regular, 11, rgb(0.8, 0.86, 0.86));
  const title = sw.title;
  page.drawText(pdfSafe(title), { x: right - bold.widthOfTextAtSize(pdfSafe(title), 20), y: 800, size: 20, font: bold, color: GOLD });
  r(monthTitle(s.month, lang), 780, regular, 12, rgb(0.9, 0.94, 0.94));

  let y = 690;
  const row = (label: string, value: string, strong = false, color = INK) => {
    t(label, left, y, strong ? bold : regular, 12);
    r(value, y, strong ? bold : regular, 12, color);
    y -= 14;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: LINE });
    y -= 22;
  };
  row(`${sw.moneyIn} (${s.paymentsReceived} ${sw.payments})`, formatRand(s.moneyInCents), true, GREEN);
  if (s.regularInCents) row(sw.regularIn, formatRand(s.regularInCents));
  row(sw.orderCosts, `-${formatRand(s.orderCostsCents)}`);
  row(sw.regularOut, `-${formatRand(s.regularOutCents)}`);
  row(sw.net, s.netCents < 0 ? `-${formatRand(-s.netCents)}` : formatRand(s.netCents), true, s.netCents < 0 ? RED : GREEN);

  y -= 8;
  t(sw.paidInFull, left, y, bold, 12);
  y -= 20;
  if (s.ordersPaidInFull.length === 0) {
    t(sw.none, left, y, regular, 11, MUTED);
    y -= 18;
  }
  for (const o of s.ordersPaidInFull.slice(0, 8)) {
    t(`${o.title} - ${o.customerName}`, left, y);
    r(formatRand(o.valueCents), y);
    y -= 18;
  }

  y -= 14;
  t(sw.latePayments, left, y, bold, 12);
  if (s.onTimeRate !== null) r(`${sw.onTime}: ${Math.round(s.onTimeRate * 100)}%`, y, regular, 11, MUTED);
  y -= 20;
  if (s.latePayments.length === 0) {
    t(sw.none, left, y, regular, 11, MUTED);
    y -= 18;
  }
  for (const l of s.latePayments.slice(0, 8)) {
    t(`${l.customerName} - ${l.orderTitle}`, left, y);
    r(`${l.daysLate} ${sw.daysLate}`, y, regular, 11, RED);
    y -= 18;
  }

  if (s.topCustomer) {
    y -= 14;
    t(`${sw.topCustomer}: ${s.topCustomer.name} (${formatRand(s.topCustomer.amountCents)})`, left, y, regular, 11, MUTED);
  }

  page.drawRectangle({ x: left, y: 60, width: 24, height: 4, color: GOLD });
  t(w.madeWith, left, 44, regular, 9, MUTED);
  return pdf.save();
}
