/**
 * A tiny in-memory stand-in for the Prisma client, supporting only what repo.ts uses:
 * equality `where` (plus `order: { businessId }` relation filters), `include` for orders,
 * nested `create` for payments and costs, and createMany.
 */
type Row = Record<string, any>;

let counter = 0;
const newId = (prefix: string) => `${prefix}_${++counter}`;

export function createFakeDb() {
  const store: Record<string, Row[]> = { customer: [], commitment: [], orderPayment: [], orderCost: [], order: [], quoteShare: [] };

  const matches = (row: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (k === "order" && v && typeof v === "object") {
        const order = store.order.find((o) => o.id === row.orderId);
        return !!order && matches(order, v);
      }
      return (row[k] ?? null) === v;
    });

  const table = (name: string, onCreate?: (data: Row) => Row) => ({
    findMany: async ({ where }: { where?: Row } = {}) => store[name].filter((r) => matches(r, where)),
    findFirst: async ({ where }: { where?: Row } = {}) => store[name].find((r) => matches(r, where)) ?? null,
    create: async ({ data }: { data: Row }) => {
      const row = onCreate ? onCreate(data) : { id: newId(name), createdAt: new Date(), ...data };
      store[name].push(row);
      return row;
    },
    createMany: async ({ data }: { data: Row[] }) => {
      data.forEach((d) => store[name].push({ id: newId(name), ...d }));
      return { count: data.length };
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const hits = store[name].filter((r) => matches(r, where));
      hits.forEach((r) => Object.assign(r, data));
      return { count: hits.length };
    },
    deleteMany: async ({ where }: { where: Row }) => {
      const before = store[name].length;
      store[name] = store[name].filter((r) => !matches(r, where));
      return { count: before - store[name].length };
    },
  });

  const db: any = {
    store,
    customer: table("customer"),
    commitment: table("commitment"),
    orderPayment: table("orderPayment"),
    orderCost: table("orderCost"),
    quoteShare: table("quoteShare"),
  };
  const orders = table("order", (data) => {
    const id = newId("order");
    const { payments, costs, ...rest } = data;
    (payments?.create ?? []).forEach((p: Row) => store.orderPayment.push({ id: newId("pay"), orderId: id, ...p }));
    (costs?.create ?? []).forEach((c: Row) => store.orderCost.push({ id: newId("cost"), orderId: id, ...c }));
    return { id, createdAt: new Date(), ...rest };
  });
  const withIncludes = (o: Row | null) =>
    o && {
      ...o,
      payments: store.orderPayment.filter((p) => p.orderId === o.id),
      costs: store.orderCost.filter((c) => c.orderId === o.id),
      customer: store.customer.find((c) => c.id === o.customerId) ?? null,
    };
  db.order = {
    ...orders,
    findMany: async (args: any) => (await orders.findMany(args)).map(withIncludes),
    findFirst: async (args: any) => withIncludes(await orders.findFirst(args)),
  };
  db.$transaction = async (fn: (tx: any) => Promise<unknown>) => fn(db);
  return db;
}
