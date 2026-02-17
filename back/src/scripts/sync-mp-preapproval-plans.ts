import { billingService } from "../billing/application/billing.service";
import { logger } from "../config/logger";

const run = async () => {
  const result = await billingService.syncPreapprovalPlans();
  logger.info("Billing preapproval plans sync completed", result);
};

run()
  .catch((error) => {
    const err = error as Error;
    logger.error("Billing preapproval plans sync failed", {
      message: err.message,
      stack: err.stack
    });
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
