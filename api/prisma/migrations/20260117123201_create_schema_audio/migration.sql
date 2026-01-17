-- CreateEnum
CREATE TYPE "AudioStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'vnd';

-- AlterTable
ALTER TABLE "plans" ALTER COLUMN "currency" SET DEFAULT 'vnd';

-- CreateTable
CREATE TABLE "audios" (
    "id" SERIAL NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "audioKey" TEXT,
    "status" "AudioStatus" NOT NULL DEFAULT 'PENDING',
    "voice" TEXT DEFAULT 'Binh',
    "duration" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audios_chapterId_key" ON "audios"("chapterId");

-- AddForeignKey
ALTER TABLE "audios" ADD CONSTRAINT "audios_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
