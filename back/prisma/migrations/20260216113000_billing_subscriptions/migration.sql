-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM (
  'INACTIVE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED'
);

-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN "billingStatus" "BillingStatus" NOT NULL DEFAULT 'INACTIVE',
ADD COLUMN "currentSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "code" "PlanType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "interval" TEXT NOT NULL DEFAULT 'month',
  "trialDays" INTEGER NOT NULL DEFAULT 0,
  "mpPreapprovalPlanId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "externalSubscriptionId" TEXT NOT NULL,
  "status" "BillingStatus" NOT NULL,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_currentSubscriptionId_key" ON "Tenant"("currentSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_externalSubscriptionId_key" ON "Subscription"("externalSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Tenant"
ADD CONSTRAINT "Tenant_currentSubscriptionId_fkey"
FOREIGN KEY ("currentSubscriptionId") REFERENCES "Subscription"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "Plan"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent"
ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
