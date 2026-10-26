/**
 * Converts database rows (Prisma) to engine inputs and back.
 * Business dates are stored as Postgres DATE, which Prisma returns as a Date
 * at midnight UTC. We only ever read the YYYY-MM-DD part.
 */
import type { ISODate } from "../engine/dates";
import type {
  BusinessInput,
  CommitmentInput,
  CostCategory,
  DateCertainty,
  Direction,
  OrderInput,
  OrderStatus,
  PaymentKind,
  Recurrence,
} from "../engine/types";

export function dateToISO(d: Date): ISODate;
export function dateToISO(d: Date | null | undefined): ISODate | null;
export function dateToISO(d: Date | null | undefined): ISODate | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function isoToDate(iso: ISODate): Date;
export function isoToDate(iso: ISODate | null | undefined): Date | null;
export function isoToDate(iso: ISODate | null | undefined): Date | null {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : null;
}

// Row shapes we rely on (structurally compatible with the generated Prisma types).
export interface PaymentRow {
  id: string;
  kind: PaymentKind;
  amountCents: number;
  expectedDate: Date | null;
  dateCertainty: DateCertainty;
  receivedDate: Date | null;
  receivedAmountCents: number | null;
}

export interface CostRow {
  id: string;
  description: string;
  category: CostCategory;
  estimatedCents: number;
  dueDate: Date | null;
  dateCertainty: DateCertainty;
  paidDate: Date | null;
  paidCents: number | null;
}

export interface OrderRow {
  id: string;
  customerId: string;
  title: string;
  valueCents: number;
  status: OrderStatus;
  createdAt: Date;
  payments: PaymentRow[];
  costs: CostRow[];
  customer?: { id: string; name: string } | null;
  /** "CHRONO" when a customer ordered through Chrono. */
  source?: string;
  note?: string | null;
}

export interface CommitmentRow {
  id: string;
  description: string;
  direction: Direction;
  amountCents: number;
  startDate: Date;
  recurrence: Recurrence;
  endDate: Date | null;
  active: boolean;
}

export interface BusinessRow {
  id: string;
  name: string;
  type: string;
  openingCashCents: number;
  openingCashDate: Date;
  safetyBufferCents: number;
  paydayWindowStart: number;
}

export function orderRowToInput(row: OrderRow): OrderInput {
  return {
    id: row.id,
    customerId: row.customerId,
    title: row.title,
    valueCents: row.valueCents,
    status: row.status,
    payments: row.payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      amountCents: p.amountCents,
      expectedDate: dateToISO(p.expectedDate),
      dateCertainty: p.dateCertainty,
      receivedDate: dateToISO(p.receivedDate),
      receivedAmountCents: p.receivedAmountCents,
    })),
    costs: row.costs.map((c) => ({
      id: c.id,
      description: c.description,
      category: c.category,
      estimatedCents: c.estimatedCents,
      dueDate: dateToISO(c.dueDate),
      dateCertainty: c.dateCertainty,
      paidDate: dateToISO(c.paidDate),
      paidCents: c.paidCents,
    })),
  };
}

export function commitmentRowToInput(row: CommitmentRow): CommitmentInput {
  return {
    id: row.id,
    description: row.description,
    direction: row.direction,
    amountCents: row.amountCents,
    startDate: dateToISO(row.startDate),
    recurrence: row.recurrence,
    endDate: dateToISO(row.endDate),
    active: row.active,
  };
}

export function businessRowToInput(row: BusinessRow): BusinessInput {
  return {
    openingCashCents: row.openingCashCents,
    openingCashDate: dateToISO(row.openingCashDate),
    safetyBufferCents: row.safetyBufferCents,
    paydayWindowStart: row.paydayWindowStart,
  };
}
