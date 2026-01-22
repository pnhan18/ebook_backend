import os
import io
import requests
from bs4 import BeautifulSoup
from mutagen.mp3 import MP3
from src.config import get_db
from src.services.storage import download_file, upload_file

class AudioService:
    @staticmethod
    async def process_chapter_audio(chapter_id: int):
        """
        Quy trình:
        1. Lấy/Tạo Audio record từ DB (Status: PENDING/PROCESSING)
        2. Download nội dung HTML từ Cloudflare (S3)
        3. Parse HTML lấy text/paragraphs
        4. Gọi API TTS để tạo audio
        5. Upload audio lên Cloudflare (S3)
        6. Cập nhật Audio record (Status: COMPLETED, audioKey)
        """
        db = get_db()
        print(f"🎧 Processing audio for chapter {chapter_id}...")

        # 1. Kiểm tra Audio record đã tồn tại chưa
        audio = await db.audio.find_unique(where={"chapterId": chapter_id})
        if audio and audio.status != "PENDING":
            print(f"⚠️ Audio record already exists for chapter {chapter_id} (Status: {audio.status}). Skipping...")
            return

        print(f"Creating/Updating audio record for chapter {chapter_id}...")
        audio = await db.audio.upsert(
            where={"chapterId": chapter_id},
            data={
                "create": {
                    "chapterId": chapter_id,
                    "status": "PROCESSING",
                },
                "update": {
                    "status": "PROCESSING",
                    "error": None,
                }
            }
        )

        try:
            # Lấy thông tin chapter để lấy contentKey
            chapter = await db.chapter.find_unique(where={"id": chapter_id})
            if not chapter or not chapter.contentKey:
                raise Exception("Chapter content not found")

            # 2. Download nội dung HTML
            html_bytes = download_file(chapter.contentKey)
            html_content = html_bytes.decode("utf-8")

            # 3. Parse HTML lấy paragraphs
            soup = BeautifulSoup(html_content, "html.parser")
            paragraphs = [p.get_text().strip() for p in soup.find_all("p") if p.get_text().strip()]
            
            if not paragraphs:
                text = soup.get_text().strip()
                if text:
                    paragraphs = [text]
                else:
                    raise Exception("No text content found in chapter")

            # 4. Gọi API TTS
            from src.config.settings import TTS_API_URL, TTS_API_KEY
            
            if not TTS_API_URL:
                raise ValueError("TTS_API_URL environment variable is not set")
            
            payload = {
                "paragraphs": paragraphs,
            }

            headers = {}
            if TTS_API_KEY:
                headers["X-API-Key"] = TTS_API_KEY

            print(f"📡 Calling TTS API for {len(paragraphs)} paragraphs...")
            response = requests.post(TTS_API_URL, json=payload, headers=headers, stream=True)
            
            if response.status_code != 200:
                raise Exception(f"TTS API failed with status {response.status_code}: {response.text}")

            # 5. Upload audio lên S3
            audio_key = chapter.contentKey.replace("chapters/", "audios/").replace(".html", ".mp3")
            audio_content = response.content # Binary data
            
            # Tính duration từ audio content
            audio_file = io.BytesIO(audio_content)
            audio_mp3 = MP3(audio_file)
            duration = int(audio_mp3.info.length)  # Duration in seconds
            print(f"⏱️ Audio duration: {duration} seconds")
            
            from src.config import get_storage_client, STORAGE_BUCKET_NAME
            s3_client = get_storage_client()
            
            print(f"⬆️ Uploading audio to {audio_key}...")
            s3_client.put_object(
                Bucket=STORAGE_BUCKET_NAME,
                Key=audio_key,
                Body=audio_content,
                ContentType="audio/mpeg"
            )

            # 6. Cập nhật Audio record thành COMPLETED
            await db.audio.update(
                where={"id": audio.id},
                data={
                    "status": "COMPLETED",
                    "audioKey": audio_key,
                    "duration": duration,
                    "error": None
                }
            )
            print(f"✅ Audio generated and uploaded to {audio_key}")

        except Exception as e:
            error_msg = str(e)
            print(f"❌ Audio generation for chapter {chapter_id} failed: {error_msg}")
            
            # Cập nhật trạng thái FAILED
            if audio:
                await db.audio.update(
                    where={"id": audio.id},
                    data={
                        "status": "FAILED",
                        "error": error_msg
                    }
                )
            raise
