-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerUserId" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'OWNER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'OWNER';

-- CreateIndex
CREATE INDEX "Order_customerUserId_idx" ON "Order"("customerUserId");
