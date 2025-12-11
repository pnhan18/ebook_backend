from src.config import db


class BookRepository:
    @staticmethod
    async def update_status(book_id: int, status: str):
        await db.book.update(
            where={"id": book_id},
            data={"status": status},
        )

    @staticmethod
    async def get_by_id(book_id: int):
        return await db.book.find_unique(where={"id": book_id})
