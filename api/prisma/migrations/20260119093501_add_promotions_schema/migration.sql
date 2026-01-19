-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('BOOK', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "PromotionDuration" AS ENUM ('ONCE', 'REPEATING', 'FOREVER');

-- AlterTable
ALTER TABLE "book_purchases" ADD COLUMN     "promotionId" INTEGER;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "promotionId" INTEGER;

-- CreateTable
CREATE TABLE "promotions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "type" "PromotionType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scope" "PromotionScope" NOT NULL DEFAULT 'BOOK',
    "duration" "PromotionDuration" NOT NULL DEFAULT 'ONCE',
    "durationInMonths" INTEGER,
    "applyToAllBooks" BOOLEAN NOT NULL DEFAULT false,
    "applyToAllPlans" BOOLEAN NOT NULL DEFAULT false,
    "minOrderValue" DECIMAL(10,2),
    "maxDiscountValue" DECIMAL(10,2),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_promotions" (
    "bookId" INTEGER NOT NULL,
    "promotionId" INTEGER NOT NULL,

    CONSTRAINT "book_promotions_pkey" PRIMARY KEY ("bookId","promotionId")
);

-- CreateTable
CREATE TABLE "plan_promotions" (
    "planId" INTEGER NOT NULL,
    "promotionId" INTEGER NOT NULL,

    CONSTRAINT "plan_promotions_pkey" PRIMARY KEY ("planId","promotionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- AddForeignKey
ALTER TABLE "book_purchases" ADD CONSTRAINT "book_purchases_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_promotions" ADD CONSTRAINT "book_promotions_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_promotions" ADD CONSTRAINT "book_promotions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_promotions" ADD CONSTRAINT "plan_promotions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_promotions" ADD CONSTRAINT "plan_promotions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
