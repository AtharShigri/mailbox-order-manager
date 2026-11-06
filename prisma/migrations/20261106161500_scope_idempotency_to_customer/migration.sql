-- DropIndex
DROP INDEX IF EXISTS "orders_idempotencyKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "orders_customerId_idempotencyKey_key" ON "orders"("customerId", "idempotencyKey");

