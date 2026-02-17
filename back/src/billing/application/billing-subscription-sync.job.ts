import { billingService } from "./billing.service";

export const billingSubscriptionSyncJob = async () => {
  return billingService.syncActiveSubscriptionsJob();
};
