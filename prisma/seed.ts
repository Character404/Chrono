import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../lib/demo/seed-demo";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../lib/demo/demo-data";
import { todayInJohannesburg } from "../lib/engine/dates";

const prisma = new PrismaClient();

seedDemo(prisma, todayInJohannesburg())
  .then(() => console.log(`Demo account ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
