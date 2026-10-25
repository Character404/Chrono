/** The same content as the PDF, as plain data, so the app can show a live preview. */
import { docDate, WORDS } from "./i18n";
import { documentNumber, documentRows, type DocumentInput } from "./order-document";

export interface DocPreview {
  title: string;
  businessName: string;
  businessType: string;
  details: { label: string; value: string }[];
  rows: { label: string; detail?: string; amount: string; strong?: boolean }[];
  note: string;
  footer: string;
}

export function buildDocPreview(input: DocumentInput): DocPreview {
  const w = WORDS[input.lang];
  const { rows, note } = documentRows(input);
  return {
    title: input.kind === "quote" ? w.quote : w.invoice,
    businessName: input.businessName,
    businessType: input.businessType,
    details: [
      { label: w.number, value: documentNumber(input.kind, input.order.id) },
      { label: w.date, value: docDate(input.today, input.lang) },
      { label: w.to, value: input.customerName },
      { label: w.order, value: input.order.title },
    ],
    rows,
    note,
    footer: w.madeWith,
  };
}
