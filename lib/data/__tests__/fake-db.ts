/**
 * A tiny in-memory stand-in for the Prisma client, supporting only what repo.ts uses:
 * flat equality `where`, `include` for orders, nested `create` for payments and costs.
 */
type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

let counter = 0;
const newId = (prefix: string) => `${prefix}_${++counter}`;

function table(name: string, store: Record<string, Row[]>, onCreate?: (data: Row) => Row) {
  store[name] = store[name] ?? [];
  return {
    findMany: async ({ where }: { where?: Row } = {}) => store[name].filter((r) => matches(r, where)),
    findFirst: async ({ where }: { where?: Row } = {}) => store[name].find((r) => matches(r, where)) ?? null,
    create: async ({ data }: { data: Row }) => {
      const row = onCreate ? onCreate(data) : { id: newId(name), ...data };
      store[name].push(row);
      return row;
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
  };
}

export function createFakeDb() {
  const store: Record<string, Row[]> = {};
  const db: any = {
    store,
    customer: table("customer", store),
    commitment: table("commitment", store),
    payment: table("payment", store),
    cost: table("cost", store),
  };
  const orders = table("order", store, (data) => {
    const id = newId("order");
    const { payments, costs, ...rest } = data;
    (payments?.create ?? []).forEach((p: Row) => store.payment.push({ id: newId("pay"), orderId: id, ...p }));
    (costs?.create ?? []).forEach((c: Row) => store.cost.push({ id: newId("cost"), orderId: id, ...c }));
    return { id, createdAt: new Date(), ...rest };
  });
  const withIncludes = (o: Row | null) =>
    o && {
      ...o,
      payments: store.payment.filter((p) => p.orderId === o.id),
      costs: store.cost.filter((c) => c.orderId === o.id),
      customer: store.customer.find((c) => c.id === o.customerId) ?? null,
    };
  db.order = {
    ...orders,
    findMany: async (args: any) => (await orders.findMany(args)).map(withIncludes),
    findFirst: async (args: any) => withIncludes(await orders.findFirst(args)),
  };
  return db;
}
