from src.config import get_db
from src.services.storage import download_file, upload_file
from src.utils import epub_to_chapters


class BookService:
    @staticmethod
    async def process_epub(book_id: int, source_key: str):
        """
        Process book from EPUB to chapters.
        1. Download EPUB from storage
        2. Parse and extract chapters
        3. Upload chapters to storage
        4. Save chapters to database
        """
        db = get_db()
        print(f"📖 Processing book {book_id}...")

        try:
            # 1. Download EPUB from storage
            print(f"  ⬇️ Downloading {source_key}")
            epub_bytes = download_file(source_key)

            # 2. Parse EPUB and extract chapters
            print("  📚 Parsing EPUB")
            chapters = epub_to_chapters(epub_bytes)

            # 3. Upload chapters and save to database
            print(f"  💾 Saving {len(chapters)} chapters")
            for i, chapter in enumerate(chapters):
                content_key = f"books/{book_id}/chapters/{chapter['slug']}.html"
                upload_file(content_key, chapter["content"])
                await db.chapter.create(
                    data={
                        "bookId": book_id,
                        "title": chapter["title"],
                        "slug": chapter["slug"],
                        "contentKey": content_key,
                        "order": i + 1,
                    }
                )

            # 4. Update book status
            await db.book.update(
                where={"id": book_id},
                data={"status": "PUBLISHED", "totalChapters": len(chapters)},
            )
            print(f"✅ Book {book_id} processed successfully!")

        except Exception as e:
            print(f"❌ Error processing book {book_id}: {e}")
            await db.book.update(
                where={"id": book_id},
                data={"status": "FAILED"},
            )
            raise
