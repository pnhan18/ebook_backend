-- CreateEnum
CREATE TYPE "BookAccessType" AS ENUM ('FREE', 'PURCHASE', 'MEMBERSHIP');

-- AlterTable
ALTER TABLE "books" ADD COLUMN     "accessType" "BookAccessType" NOT NULL DEFAULT 'FREE';

-- CreateIndex
CREATE INDEX "books_accessType_idx" ON "books"("accessType");
