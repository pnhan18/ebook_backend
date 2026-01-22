import asyncio
from src.celery_app import app
from src.services.audio_service import AudioService
from src.config import init_db, close_db


def run_async(coro):
    """Helper to run async code in sync Celery task."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@app.task(name="generate_chapter_audio", queue="audio", bind=True, max_retries=3, default_retry_delay=60)
def generate_chapter_audio(self, chapter_id: int):
    """
    Generate audio for a chapter using TTS.

    Usage:
        process_chapter_audio.delay(chapter_id=123)
    """
    try:
        async def _process():
            await init_db()
            try:
                await AudioService.process_chapter_audio(chapter_id)
            finally:
                await close_db()

        run_async(_process())

    except Exception as e:
        print(f"❌ Audio task failed for chapter {chapter_id}: {e}")
        raise self.retry(exc=e)
