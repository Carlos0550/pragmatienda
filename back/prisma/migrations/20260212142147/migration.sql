/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `BusinessData` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `BusinessData` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `BusinessData` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "BusinessData_name_idx" ON "BusinessData"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessData_name_key" ON "BusinessData"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessData_phone_key" ON "BusinessData"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessData_email_key" ON "BusinessData"("email");
