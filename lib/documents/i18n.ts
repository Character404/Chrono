/**
 * Words used on customer documents (quotes and invoices).
 *
 * SEPEDI: these translations are a first draft and MUST be checked by a fluent
 * Sepedi speaker before use. Change any phrase here; nothing else needs editing.
 */
import type { ISODate } from "../engine/dates";

export type DocLang = "en" | "nso";
export const DOC_LANGS: { code: DocLang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "nso", label: "Sepedi" },
];

export interface DocWords {
  quote: string;
  invoice: string;
  number: string;
  date: string;
  from: string;
  to: string;
  order: string;
  orderTotal: string;
  depositToConfirm: string;
  balance: string;
  paidSoFar: string;
  amountDue: string;
  dueBy: string;
  byDate: string;
  dateToAgree: string;
  quoteNote: string;
  invoiceNote: string;
  paymentDetails: string;
  madeWith: string;
  months: string[];
  summary: SummaryWords;
}

export interface SummaryWords {
  title: string;
  moneyIn: string;
  payments: string;
  orderCosts: string;
  regularOut: string;
  regularIn: string;
  net: string;
  paidInFull: string;
  latePayments: string;
  daysLate: string;
  none: string;
  onTime: string;
  topCustomer: string;
}

export const WORDS: Record<DocLang, DocWords> = {
  en: {
    quote: "Quote",
    invoice: "Invoice",
    number: "Number",
    date: "Date",
    from: "From",
    to: "To",
    order: "Order",
    orderTotal: "Order total",
    depositToConfirm: "Deposit to confirm the order",
    balance: "Balance",
    paidSoFar: "Paid so far",
    amountDue: "Amount due",
    dueBy: "Due by",
    byDate: "by",
    dateToAgree: "date to be agreed",
    quoteNote: "Please pay the deposit to confirm your order.",
    invoiceNote: "Thank you for your order. Please pay the amount due by the date shown.",
    paymentDetails: "Payment details as agreed with",
    madeWith: "Made with Chrono",
    summary: {
      title: "Monthly summary",
      moneyIn: "Money in",
      payments: "payments",
      orderCosts: "Order costs paid",
      regularOut: "Regular payments out",
      regularIn: "Regular money in",
      net: "Left over this month",
      paidInFull: "Orders paid in full",
      latePayments: "Late payments",
      daysLate: "days late",
      none: "None",
      onTime: "Paid on time",
      topCustomer: "Biggest customer",
    },
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
  nso: {
    quote: "Kakanyetšo ya Theko",
    invoice: "Inboisi",
    number: "Nomoro",
    date: "Letšatšikgwedi",
    from: "Go tšwa go",
    to: "Go",
    order: "Odara",
    orderTotal: "Palomoka ya odara",
    depositToConfirm: "Tefo ya pele go netefatša odara",
    balance: "Tšhaletšo",
    paidSoFar: "Tšeo di lefilwego",
    amountDue: "Tšhelete ye e šetšego",
    dueBy: "E swanetše go lefelwa ka",
    byDate: "ka",
    dateToAgree: "letšatši le tla dumelelanwa",
    quoteNote: "Hle lefa tefo ya pele go netefatša odara ya gago.",
    invoiceNote: "Re a leboga ka odara ya gago. Hle lefa tšhelete ye e šetšego ka letšatši le le bontšhitšwego.",
    paymentDetails: "Dintlha tša tefo bjalo ka ge le dumelelane le",
    madeWith: "E dirilwe ka Chrono",
    summary: {
      title: "Kakaretšo ya Kgwedi",
      moneyIn: "Tšhelete ye e tsenego",
      payments: "ditefo",
      orderCosts: "Ditshenyegelo tša diodara",
      regularOut: "Ditefo tša ka mehla",
      regularIn: "Tšhelete ya ka mehla ye e tsenego",
      net: "Tše di šetšego kgweding ye",
      paidInFull: "Diodara tše di lefetšwego ka botlalo",
      latePayments: "Ditefo tše di diegilego",
      daysLate: "matšatši morago",
      none: "Ga go na",
      onTime: "Tše di lefilwego ka nako",
      topCustomer: "Moreki yo mogolo",
    },
    months: ["Janaware", "Feberware", "Matšhe", "Aporele", "Mei", "June", "Julae", "Agostose", "Setemere", "Oktoboro", "Nofemere", "Disemere"],
  },
};

/** "2 November 2026" / "2 Nofemere 2026" */
export function docDate(date: ISODate, lang: DocLang): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${WORDS[lang].months[m - 1]} ${y}`;
}

export function isDocLang(v: unknown): v is DocLang {
  return v === "en" || v === "nso";
}
