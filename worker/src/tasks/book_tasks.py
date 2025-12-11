import asyncio
from src.celery_app import app
from src.services.book_service import BookService
from src.config import init_db, close_db


def run_async(coro):
    """Helper to run async code in sync Celery task."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_book(self, book_id: int, source_key: str):
    """
    Process book from EPUB to chapters.

    Usage from API:
        from src.tasks import process_book
        process_book.delay(book_id=123, source_key="uploads/book.epub")
    """
    try:

        async def _process():
            await init_db()
            try:
                await BookService.process_epub(book_id, source_key)
            finally:
                await close_db()

        run_async(_process())

    except Exception as e:
        print(f"❌ Task failed: {e}")
        raise self.retry(exc=e)
