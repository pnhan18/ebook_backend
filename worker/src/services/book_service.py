from src.config import get_db
from src.services.storage import download_file, upload_file
from src.utils.converter import epub_to_chapters


def make_unique_slug(base_slug: str, used_slugs: set) -> str:
    """
    Tạo slug duy nhất bằng cách thêm số vào cuối nếu bị trùng.
    Ví dụ: chuong-1 → chuong-1-2 → chuong-1-3
    """
    if base_slug not in used_slugs:
        used_slugs.add(base_slug)
        return base_slug
    
    counter = 2
    while True:
        new_slug = f"{base_slug}-{counter}"
        if new_slug not in used_slugs:
            used_slugs.add(new_slug)
            return new_slug
        counter += 1


class BookService:
    @staticmethod
    async def process_epub(book_id: int, source_key: str):
        """
        Process book from EPUB to chapters.
        """
        db = get_db()
        print(f"📖 Processing book {book_id}...")

        try:
            # Kiểm tra book có tồn tại không
            book = await db.book.find_unique(where={"id": book_id})
            if not book:
                print(f"⚠️ Book {book_id} not found in database, skipping...")
                return
            
            epub_bytes = download_file(source_key)
            chapters = epub_to_chapters(epub_bytes)

            # In tên các chapter
            print(f"📚 Found {len(chapters)} chapters:")
            for i, ch in enumerate(chapters, 1):
                print(f"  {i}. {ch['title']}")

            # Lấy danh sách slug đã tồn tại trong database
            existing_chapters = await db.chapter.find_many(
                where={"bookId": book_id}
            )
            used_slugs = {ch.slug for ch in existing_chapters}

            # Upload chapters và lưu vào database
            for i, chapter in enumerate(chapters):
                unique_slug = make_unique_slug(chapter["slug"], used_slugs)
                content_key = f"books/{book_id}/chapters/{unique_slug}.html"
                upload_file(content_key, chapter["content"])
                await db.chapter.create(
                    data={
                        "bookId": book_id,
                        "title": chapter["title"],
                        "slug": unique_slug,
                        "contentKey": content_key,
                        "order": i + 1,
                    }
                )

            # Update book status
            total_chapters = await db.chapter.count(where={"bookId": book_id})
            await db.book.update(
                where={"id": book_id},
                data={"status": "PUBLISHED", "totalChapters": total_chapters},
            )
            print(f"✅ Book {book_id} done!")

        except Exception as e:
            print(f"❌ Book {book_id} failed: {e}")
            await db.book.update(
                where={"id": book_id},
                data={"status": "FAILED"},
            )
            raise
