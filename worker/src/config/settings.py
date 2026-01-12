import os

DATABASE_URL = os.getenv("DATABASE_URL")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Object Storage (Cloudflare R2 / S3 compatible)
STORAGE_ENDPOINT_URL = os.getenv("STORAGE_ENDPOINT_URL")
STORAGE_ACCESS_KEY_ID = os.getenv("STORAGE_ACCESS_KEY_ID")
STORAGE_SECRET_ACCESS_KEY = os.getenv("STORAGE_SECRET_ACCESS_KEY")
STORAGE_BUCKET_NAME = os.getenv("STORAGE_BUCKET_NAME")
