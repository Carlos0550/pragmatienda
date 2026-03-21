import { PlanType } from "@prisma/client";
import { billingService } from "../billing/application/billing.service";
import { logger } from "../config/logger";
import { disconnectPrisma } from "../db/prisma";
import { BillingError } from "../billing/domain/billing-errors";

type PaidPlanCode = Extract<PlanType, "STARTER" | "PRO">;

type CliArgs = {
  tenantId: string;
  planCode: PaidPlanCode;
};

const USAGE = "Uso: npm run billing:assign-plan -- --tenantId <tenant-id> --plan <STARTER|PRO>";

const getFlagValue = (args: string[], flag: string): string | null => {
  const exactIndex = args.findIndex((arg) => arg === flag);
  if (exactIndex >= 0) {
    const next = args[exactIndex + 1]?.trim();
    return next ? next : null;
  }

  const prefix = `${flag}=`;
  const matched = args.find((arg) => arg.startsWith(prefix));
  if (!matched) {
    return null;
  }

  const value = matched.slice(prefix.length).trim();
  return value.length > 0 ? value : null;
};

const parsePlanCode = (value: string | null): PaidPlanCode => {
  const normalized = value?.trim().toUpperCase();
  if (normalized === PlanType.STARTER || normalized === PlanType.PRO) {
    return normalized;
  }

  throw new Error(`El plan debe ser STARTER o PRO. ${USAGE}`);
};

const parseArgs = (argv: string[]): CliArgs => {
  const tenantId = getFlagValue(argv, "--tenantId");
  if (!tenantId) {
    throw new Error(`Debe indicar --tenantId. ${USAGE}`);
  }

  const planCode = parsePlanCode(getFlagValue(argv, "--plan"));
  return { tenantId, planCode };
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const result = await billingService.assignPlanManually(args.tenantId, args.planCode);

  logger.info("Plan asignado manualmente al tenant", {
    tenantId: args.tenantId,
    planCode: result.planCode,
    planId: result.planId,
    subscriptionId: result.subscriptionId,
    externalSubscriptionId: result.externalSubscriptionId
  });
};

run()
  .catch((error) => {
    if (error instanceof BillingError) {
      logger.error("No se pudo asignar el plan manualmente", {
        code: error.code,
        message: error.message,
        details: error.details
      });
    } else {
      const err = error as Error;
      logger.error("Fallo inesperado al asignar el plan manualmente", {
        message: err.message,
        stack: err.stack
      });
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
    process.exit(process.exitCode ?? 0);
  });
