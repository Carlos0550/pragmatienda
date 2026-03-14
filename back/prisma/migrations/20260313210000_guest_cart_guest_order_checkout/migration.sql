ALTER TABLE "Order"
ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "guestName" TEXT,
ADD COLUMN "guestEmail" TEXT,
ADD COLUMN "guestPhone" TEXT;

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_userId_fkey";

ALTER TABLE "Order"
ADD CONSTRAINT "Order_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GuestCart" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuestCart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestCartItem" (
  "id" TEXT NOT NULL,
  "guestCartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuestCartItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestCart_token_key" ON "GuestCart"("token");
CREATE UNIQUE INDEX "GuestCart_tenantId_token_key" ON "GuestCart"("tenantId", "token");
CREATE INDEX "GuestCart_tenantId_idx" ON "GuestCart"("tenantId");

CREATE INDEX "GuestCartItem_guestCartId_idx" ON "GuestCartItem"("guestCartId");
CREATE INDEX "GuestCartItem_productId_idx" ON "GuestCartItem"("productId");
CREATE UNIQUE INDEX "GuestCartItem_guestCartId_productId_key" ON "GuestCartItem"("guestCartId", "productId");

ALTER TABLE "GuestCart"
ADD CONSTRAINT "GuestCart_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuestCartItem"
ADD CONSTRAINT "GuestCartItem_guestCartId_fkey"
FOREIGN KEY ("guestCartId") REFERENCES "GuestCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuestCartItem"
ADD CONSTRAINT "GuestCartItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
