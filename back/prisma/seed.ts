import { PlanType } from "@prisma/client";
import { prisma } from "../src/db/prisma";

const plans = [
  {
    code: PlanType.FREE,
    name: "Free",
    description: "Plan inicial sin suscripción paga.",
    price: 0,
    currency: "ARS",
    interval: "month",
    trialDays: 0
  },
  {
    code: PlanType.STARTER,
    name: "Starter",
    description: "Plan para tiendas en crecimiento.",
    price: 9999,
    currency: "ARS",
    interval: "month",
    trialDays: 7
  },
  {
    code: PlanType.PRO,
    name: "Pro",
    description: "Plan avanzado para tiendas escalables.",
    price: 24999,
    currency: "ARS",
    interval: "month",
    trialDays: 7
  }
];

async function main() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        trialDays: plan.trialDays,
        active: true
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        trialDays: plan.trialDays,
        active: true
      }
    });
  }
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
