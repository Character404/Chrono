import type { ISODate } from "./dates";
import type { Cents } from "./money";

export type DateCertainty = "CONFIRMED" | "ESTIMATED" | "UNKNOWN";
export type PaymentKind = "DEPOSIT" | "BALANCE" | "INSTALMENT";
export type OrderStatus = "DRAFT" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";
export type CostCategory = "INGREDIENTS" | "MATERIALS" | "PACKAGING" | "TRANSPORT" | "LABOUR" | "OTHER";
export type Direction = "IN" | "OUT";
export type Recurrence = "NONE" | "WEEKLY" | "MONTHLY";

export interface PaymentInput {
  id: string;
  kind: PaymentKind;
  amountCents: Cents;
  /** null when the date is unknown */
  expectedDate: ISODate | null;
  dateCertainty: DateCertainty;
  receivedDate?: ISODate | null;
  receivedAmountCents?: Cents | null;
}

export interface CostInput {
  id: string;
  description: string;
  category: CostCategory;
  estimatedCents: Cents;
  /** null when the date is unknown */
  dueDate: ISODate | null;
  dateCertainty: DateCertainty;
  paidDate?: ISODate | null;
  paidCents?: Cents | null;
}

export interface OrderInput {
  id: string;
  customerId: string;
  title: string;
  valueCents: Cents;
  status: OrderStatus;
  payments: PaymentInput[];
  costs: CostInput[];
}

export interface CommitmentInput {
  id: string;
  description: string;
  direction: Direction;
  amountCents: Cents;
  startDate: ISODate;
  recurrence: Recurrence;
  endDate?: ISODate | null;
  active: boolean;
}

export interface BusinessInput {
  openingCashCents: Cents;
  openingCashDate: ISODate;
  safetyBufferCents: Cents;
  /** First day of the month-end payday window (default 25). */
  paydayWindowStart?: number;
}

export interface ForecastInput {
  today: ISODate;
  business: BusinessInput;
  commitments: CommitmentInput[];
  /** All saved orders of the business (any status). Only ACCEPTED ones add future events. */
  orders: OrderInput[];
  /** The order being checked (may be unsaved), or null for a plain business forecast. */
  proposedOrder: OrderInput | null;
  /** Optional customer names, used only in explanations. */
  customerNames?: Record<string, string>;
}
