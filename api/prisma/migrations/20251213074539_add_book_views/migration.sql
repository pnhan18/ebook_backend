-- AlterTable
ALTER TABLE "books" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "book_views" (
    "id" SERIAL NOT NULL,
    "bookId" INTEGER NOT NULL,
    "userId" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_views_bookId_idx" ON "book_views"("bookId");

-- CreateIndex
CREATE INDEX "book_views_userId_idx" ON "book_views"("userId");

-- CreateIndex
CREATE INDEX "book_views_viewedAt_idx" ON "book_views"("viewedAt");

-- CreateIndex
CREATE INDEX "book_views_bookId_ipAddress_idx" ON "book_views"("bookId", "ipAddress");

-- CreateIndex
CREATE INDEX "books_viewCount_idx" ON "books"("viewCount");

-- AddForeignKey
ALTER TABLE "book_views" ADD CONSTRAINT "book_views_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_views" ADD CONSTRAINT "book_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
