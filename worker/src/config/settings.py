import os

DATABASE_URL = os.getenv("DATABASE_URL")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Object Storage (Cloudflare R2 / S3 compatible)
STORAGE_ENDPOINT_URL = os.getenv("R2_ENDPOINT")
STORAGE_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
STORAGE_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
STORAGE_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

# TTS Service
TTS_API_URL = os.getenv("TTS_API_URL")
TTS_API_KEY = os.getenv("TTS_API_KEY")

