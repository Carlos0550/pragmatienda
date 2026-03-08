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
    trialDays: 0,
    maxProducts: 10,
    maxCategories: 3,
    features: { reports: false, api: false, seo: false }
  },
  {
    code: PlanType.STARTER,
    name: "Starter",
    description: "Plan para tiendas en crecimiento.",
    price: 9999,
    currency: "ARS",
    interval: "month",
    trialDays: 7,
    maxProducts: 100,
    maxCategories: 10,
    features: { reports: true, api: false, seo: true }
  },
  {
    code: PlanType.PRO,
    name: "Pro",
    description: "Plan avanzado para tiendas escalables.",
    price: 24999,
    currency: "ARS",
    interval: "month",
    trialDays: 7,
    maxProducts: null,
    maxCategories: null,
    features: { reports: true, api: true, seo: true }
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
        active: true,
        maxProducts: plan.maxProducts ?? null,
        maxCategories: plan.maxCategories ?? null,
        features: plan.features ?? undefined
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        trialDays: plan.trialDays,
        active: true,
        maxProducts: plan.maxProducts ?? null,
        maxCategories: plan.maxCategories ?? null,
        features: plan.features ?? undefined
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
