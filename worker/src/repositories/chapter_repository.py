from src.config import db


class ChapterRepository:
    @staticmethod
    async def create(
        book_id: int,
        title: str,
        slug: str,
        content_key: str,
        order: int,
    ) -> int:
        chapter = await db.chapter.create(
            data={
                "bookId": book_id,
                "title": title,
                "slug": slug,
                "contentKey": content_key,
                "order": order,
            }
        )
        return chapter.id

    @staticmethod
    async def get_by_book_id(book_id: int):
        return await db.chapter.find_many(
            where={"bookId": book_id},
            order_by={"order": "asc"},
        )
