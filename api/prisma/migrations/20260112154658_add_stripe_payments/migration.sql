/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'INCOMPLETE', 'TRIALING');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeReceiptUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_purchases" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_stripePaymentIntentId_idx" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "book_purchases_userId_idx" ON "book_purchases"("userId");

-- CreateIndex
CREATE INDEX "book_purchases_bookId_idx" ON "book_purchases"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "book_purchases_userId_bookId_key" ON "book_purchases"("userId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_stripeSubscriptionId_idx" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_stripeCustomerId_idx" ON "subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "users_stripeCustomerId_idx" ON "users"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_purchases" ADD CONSTRAINT "book_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_purchases" ADD CONSTRAINT "book_purchases_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_purchases" ADD CONSTRAINT "book_purchases_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
