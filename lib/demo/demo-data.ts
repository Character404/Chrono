/**
 * Demo business: Lerato's Kitchen, a home catering business in Soshanguve.
 * Built relative to `today` so the demo always looks current.
 * Pure data only; prisma/seed and the demo login write it to the database.
 *
 * Designed so that every intelligent feature shows within a judge's first minute:
 * - Thabo usually pays about a week late (customer lateness prediction)
 * - most other customers pay at month-end (payday pattern)
 * - actual costs run about 8% above estimates (cost estimate bias)
 * - the wedding's ingredients are well above the usual cost (cost drift warning)
 * - the pending wedding order looks fine as entered, but leaves Lerato short of cash
 *   once Chrono adjusts for how Thabo really pays.
 */
import { analyzeOrder } from "../engine/analyze";
import { forecast } from "../engine/forecast";
import { addDays, dateParts, makeDateClamped, type ISODate } from "../engine/dates";
import { rand } from "../engine/money";
import type { BusinessInput, CommitmentInput, CostCategory, OrderInput } from "../engine/types";

export const DEMO_EMAIL = "demo@chrono.app";
export const DEMO_PASSWORD = "Chrono2026!";

export interface DemoCustomer {
  id: string;
  name: string;
  phone?: string;
}

export interface DemoData {
  business: BusinessInput & { name: string; type: string };
  customers: DemoCustomer[];
  orders: OrderInput[];
  commitments: CommitmentInput[];
}

export const DEMO_IDS = {
  wedding: "demo-order-wedding",
  cake: "demo-order-cake",
  thabo: "demo-cust-thabo",
} as const;

const CUSTOMERS: DemoCustomer[] = [
  { id: "demo-cust-thabo", name: "Thabo Mokoena" },
  { id: "demo-cust-naledi", name: "Naledi Dlamini" },
  { id: "demo-cust-sipho", name: "Sipho Ndlovu" },
  { id: "demo-cust-zanele", name: "Zanele Khumalo" },
  { id: "demo-cust-karabo", name: "Karabo Molefe" },
  { id: "demo-cust-ayanda", name: "Ayanda Zulu" },
];

/** One past order: when the balance was due, how late it came, and what the main cost was. */
interface PastOrderSpec {
  monthsAgo: number;
  dueDay: number;
  customer: string;
  title: string;
  value: number;
  deposit: number;
  lateDays: number;
  partial?: number; // rands received on the due date before the rest came later
  cost: { description: string; category: CostCategory; estimate: number; actual: number };
}

const PAST: PastOrderSpec[] = [
  // Thabo: usually about a week late.
  { monthsAgo: 4, dueDay: 12, customer: "demo-cust-thabo", title: "Family lunch", value: 3000, deposit: 800, lateDays: 6, cost: { description: "Lunch packs", category: "OTHER", estimate: 1500, actual: 1620 } },
  { monthsAgo: 3, dueDay: 10, customer: "demo-cust-thabo", title: "Graduation party", value: 4200, deposit: 1000, lateDays: 8, cost: { description: "Ingredients", category: "INGREDIENTS", estimate: 2500, actual: 2700 } },
  { monthsAgo: 2, dueDay: 14, customer: "demo-cust-thabo", title: "Church function", value: 3600, deposit: 900, lateDays: 7, cost: { description: "Ingredients", category: "INGREDIENTS", estimate: 2400, actual: 2600 } },
  { monthsAgo: 1, dueDay: 9, customer: "demo-cust-thabo", title: "Birthday braai", value: 4000, deposit: 900, lateDays: 7, cost: { description: "Meat and sides", category: "INGREDIENTS", estimate: 2500, actual: 2700 } },

  // Naledi: always on time, at month-end.
  { monthsAgo: 4, dueDay: 27, customer: "demo-cust-naledi", title: "Baby shower", value: 2200, deposit: 600, lateDays: 0, cost: { description: "Cupcakes and platters", category: "OTHER", estimate: 1100, actual: 1180 } },
  { monthsAgo: 3, dueDay: 26, customer: "demo-cust-naledi", title: "Office tea", value: 1500, deposit: 500, lateDays: 0, cost: { description: "Packaging", category: "PACKAGING", estimate: 300, actual: 330 } },
  { monthsAgo: 2, dueDay: 28, customer: "demo-cust-naledi", title: "Kitchen party", value: 2600, deposit: 700, lateDays: 0, cost: { description: "Ingredients", category: "INGREDIENTS", estimate: 2550, actual: 2750 } },
  { monthsAgo: 1, dueDay: 26, customer: "demo-cust-naledi", title: "Book club snacks", value: 1200, deposit: 400, lateDays: 0, cost: { description: "Snack packs", category: "OTHER", estimate: 600, actual: 640 } },

  // Sipho: pays part on the day, the rest a few days later.
  { monthsAgo: 4, dueDay: 25, customer: "demo-cust-sipho", title: "Team lunch", value: 3200, deposit: 800, lateDays: 3, partial: 1200, cost: { description: "Ingredients", category: "INGREDIENTS", estimate: 2500, actual: 2680 } },
  { monthsAgo: 2, dueDay: 25, customer: "demo-cust-sipho", title: "Year-end function", value: 3400, deposit: 900, lateDays: 4, partial: 1500, cost: { description: "Transport", category: "TRANSPORT", estimate: 400, actual: 450 } },
  { monthsAgo: 1, dueDay: 25, customer: "demo-cust-sipho", title: "Staff breakfast", value: 3800, deposit: 900, lateDays: 3, partial: 1500, cost: { description: "Ingredients", category: "INGREDIENTS", estimate: 2550, actual: 2750 } },

  // Zanele, Karabo and Ayanda: mostly month-end payers.
  { monthsAgo: 4, dueDay: 29, customer: "demo-cust-zanele", title: "Engagement party", value: 4000, deposit: 1000, lateDays: 1, cost: { description: "Ingredients", category: "INGREDIENTS", estimate: 2600, actual: 2800 } },
  { monthsAgo: 3, dueDay: 27, customer: "demo-cust-zanele", title: "Memorial tea", value: 1800, deposit: 500, lateDays: 0, cost: { description: "Tea and scones", category: "OTHER", estimate: 900, actual: 960 } },
  { monthsAgo: 1, dueDay: 28, customer: "demo-cust-zanele", title: "Heritage day lunch", value: 2400, deposit: 600, lateDays: 1, cost: { description: "Packaging", category: "PACKAGING", estimate: 350, actual: 380 } },
  { monthsAgo: 3, dueDay: 30, customer: "demo-cust-karabo", title: "21st birthday", value: 3500, deposit: 900, lateDays: 0, cost: { description: "Ingredients", category: "INGREDIENTS", estimate: 2500, actual: 2700 } },
  { monthsAgo: 2, dueDay: 26, customer: "demo-cust-karabo", title: "Soccer club dinner", value: 3900, deposit: 900, lateDays: 0, cost: { description: "Meat", category: "INGREDIENTS", estimate: 2450, actual: 2650 } },
  { monthsAgo: 4, dueDay: 26, customer: "demo-cust-ayanda", title: "Stokvel lunch", value: 1600, deposit: 500, lateDays: 0, cost: { description: "Food packs", category: "OTHER", estimate: 800, actual: 860 } },
  { monthsAgo: 3, dueDay: 28, customer: "demo-cust-ayanda", title: "Wedding tasting", value: 900, deposit: 300, lateDays: 0, cost: { description: "Tasting samples", category: "OTHER", estimate: 400, actual: 430 } },
  { monthsAgo: 2, dueDay: 27, customer: "demo-cust-ayanda", title: "Kids party", value: 1400, deposit: 400, lateDays: 0, cost: { description: "Packaging", category: "PACKAGING", estimate: 250, actual: 270 } },
  { monthsAgo: 1, dueDay: 27, customer: "demo-cust-ayanda", title: "Prayer meeting", value: 1100, deposit: 300, lateDays: 0, cost: { description: "Tea and biscuits", category: "OTHER", estimate: 550, actual: 590 } },
];

function monthsBack(today: ISODate, monthsAgo: number, day: number): ISODate {
  const { year, month } = dateParts(today);
  return makeDateClamped(year, month - monthsAgo, day);
}

function pastOrder(spec: PastOrderSpec, i: number, today: ISODate): OrderInput {
  const due = monthsBack(today, spec.monthsAgo, spec.dueDay);
  const ordered = addDays(due, -10);
  const received = addDays(due, spec.lateDays);
  const balance = spec.value - spec.deposit;
  const id = `demo-past-${i + 1}`;
  const payments: OrderInput["payments"] = [
    { id: `${id}-dep`, kind: "DEPOSIT", amountCents: rand(spec.deposit), expectedDate: ordered, dateCertainty: "CONFIRMED", receivedDate: ordered, receivedAmountCents: rand(spec.deposit) },
  ];
  if (spec.partial) {
    payments.push(
      { id: `${id}-p1`, kind: "INSTALMENT", amountCents: rand(spec.partial), expectedDate: due, dateCertainty: "ESTIMATED", receivedDate: due, receivedAmountCents: rand(spec.partial) },
      { id: `${id}-p2`, kind: "BALANCE", amountCents: rand(balance - spec.partial), expectedDate: due, dateCertainty: "ESTIMATED", receivedDate: received, receivedAmountCents: rand(balance - spec.partial) },
    );
  } else {
    payments.push({ id: `${id}-bal`, kind: "BALANCE", amountCents: rand(balance), expectedDate: due, dateCertainty: "ESTIMATED", receivedDate: received, receivedAmountCents: rand(balance) });
  }
  return {
    id,
    customerId: spec.customer,
    title: spec.title,
    valueCents: rand(spec.value),
    status: "COMPLETED",
    payments,
    costs: [
      {
        id: `${id}-cost`,
        description: spec.cost.description,
        category: spec.cost.category,
        estimatedCents: rand(spec.cost.estimate),
        dueDate: addDays(due, -2),
        dateCertainty: "CONFIRMED",
        paidDate: addDays(due, -2),
        paidCents: rand(spec.cost.actual),
      },
    ],
  };
}

function buildWithOpening(today: ISODate, openingRands: number): DemoData {
  const d = (n: number) => addDays(today, n);
  const past = PAST.map((spec, i) => pastOrder(spec, i, today));

  const accepted: OrderInput[] = [
    {
      id: "demo-order-platter",
      customerId: "demo-cust-naledi",
      title: "Birthday platter",
      valueCents: rand(2400),
      status: "ACCEPTED",
      payments: [
        { id: "demo-platter-dep", kind: "DEPOSIT", amountCents: rand(800), expectedDate: d(-2), dateCertainty: "CONFIRMED", receivedDate: d(-2), receivedAmountCents: rand(800) },
        { id: "demo-platter-bal", kind: "BALANCE", amountCents: rand(1600), expectedDate: d(4), dateCertainty: "CONFIRMED" },
      ],
      costs: [{ id: "demo-platter-cost", description: "Platter ingredients", category: "INGREDIENTS", estimatedCents: rand(1100), dueDate: d(3), dateCertainty: "CONFIRMED" }],
    },
    {
      id: "demo-order-lunch",
      customerId: "demo-cust-naledi",
      title: "Corporate lunch",
      valueCents: rand(3500),
      status: "ACCEPTED",
      payments: [
        { id: "demo-lunch-dep", kind: "DEPOSIT", amountCents: rand(1000), expectedDate: d(-1), dateCertainty: "CONFIRMED", receivedDate: d(-1), receivedAmountCents: rand(1000) },
        { id: "demo-lunch-bal", kind: "BALANCE", amountCents: rand(2500), expectedDate: d(16), dateCertainty: "CONFIRMED" },
      ],
      costs: [{ id: "demo-lunch-cost", description: "Lunch ingredients", category: "INGREDIENTS", estimatedCents: rand(1500), dueDate: d(18), dateCertainty: "CONFIRMED" }],
    },
  ];

  // A small Thabo order whose balance is already overdue, so judges can record it
  // as received and watch Chrono's picture of Thabo update.
  accepted.push({
    id: DEMO_IDS.cake,
    customerId: DEMO_IDS.thabo,
    title: "Birthday cake",
    valueCents: rand(900),
    status: "ACCEPTED",
    payments: [
      { id: "demo-cake-dep", kind: "DEPOSIT", amountCents: rand(300), expectedDate: d(-14), dateCertainty: "CONFIRMED", receivedDate: d(-14), receivedAmountCents: rand(300) },
      { id: "demo-cake-bal", kind: "BALANCE", amountCents: rand(600), expectedDate: d(-9), dateCertainty: "CONFIRMED" },
    ],
    costs: [{ id: "demo-cake-cost", description: "Cake ingredients", category: "OTHER", estimatedCents: rand(350), dueDate: d(-11), dateCertainty: "CONFIRMED", paidDate: d(-11), paidCents: rand(370) }],
  });

  // The headline demo moment.
  const wedding: OrderInput = {
    id: DEMO_IDS.wedding,
    customerId: DEMO_IDS.thabo,
    title: "Wedding catering",
    valueCents: rand(5000),
    status: "DRAFT",
    payments: [
      { id: "demo-wedding-dep", kind: "DEPOSIT", amountCents: rand(1000), expectedDate: d(0), dateCertainty: "CONFIRMED" },
      { id: "demo-wedding-bal", kind: "BALANCE", amountCents: rand(4000), expectedDate: d(7), dateCertainty: "ESTIMATED" },
    ],
    costs: [
      { id: "demo-wedding-ing", description: "Ingredients", category: "INGREDIENTS", estimatedCents: rand(3200), dueDate: d(2), dateCertainty: "CONFIRMED" },
    ],
  };

  // Recurring bills are placed relative to today (demo only), so the demo behaves
  // the same whichever day a judge opens it.
  const dayOf = (n: number) => dateParts(d(n)).day;
  const commitments: CommitmentInput[] = [
    { id: "demo-rent", description: "Rent", direction: "OUT", amountCents: rand(2500), startDate: monthsBack(d(9), 6, dayOf(9)), recurrence: "MONTHLY", active: true },
    { id: "demo-transport", description: "Transport", direction: "OUT", amountCents: rand(300), startDate: d(-4), recurrence: "WEEKLY", active: true },
    { id: "demo-data", description: "Data and airtime", direction: "OUT", amountCents: rand(150), startDate: monthsBack(d(16), 6, dayOf(16)), recurrence: "MONTHLY", active: true },
  ];

  return {
    business: { name: "Lerato's Kitchen", type: "Catering, Soshanguve", openingCashCents: rand(openingRands), openingCashDate: today, safetyBufferCents: rand(500), paydayWindowStart: 25 },
    customers: CUSTOMERS,
    orders: [...past, ...accepted, wedding],
    commitments,
  };
}

/** The forecast input for checking the demo wedding order. */
export function demoWeddingInput(data: DemoData, today: ISODate) {
  const wedding = data.orders.find((o) => o.id === DEMO_IDS.wedding)!;
  return {
    today,
    business: data.business,
    commitments: data.commitments,
    orders: data.orders.filter((o) => o.id !== wedding.id),
    proposedOrder: wedding,
    customerNames: Object.fromEntries(data.customers.map((c) => [c.id, c.name.split(" ")[0]])),
  };
}

/**
 * Builds the demo with an opening balance chosen for today's calendar, so the
 * wedding order always looks Safe as entered but shows a fixable cash shortfall
 * once Chrono adjusts for how Thabo really pays. (Rent on the 1st moves around
 * relative to today, so a fixed balance would only work on some days.)
 */
export function buildDemoData(today: ISODate): DemoData {
  const marginRands = 200;
  for (let opening = 2000; opening <= 15000; opening += 50) {
    const data = buildWithOpening(today, opening);
    const a = analyzeOrder(demoWeddingInput(data, today));
    const buffer = data.business.safetyBufferCents;
    // The business must be healthy on its own, so only the wedding causes the problem.
    const baseline = forecast({ ...demoWeddingInput(data, today), proposedOrder: null });
    if (
      baseline.minBalanceCents >= buffer + rand(marginRands) &&
      a.asEntered.verdict === "SAFE" &&
      a.asEntered.minBalanceCents >= buffer + rand(marginRands) &&
      a.primary.verdict === "SHORTFALL" &&
      a.deposit.status === "INCREASE"
    ) {
      return data;
    }
  }
  return buildWithOpening(today, 6500);
}
