import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

from src.config import celery_config

# Dynamic task loading based on WORKER_TYPE
# This prevents importing heavy dependencies when not needed
WORKER_TYPE = os.environ.get("WORKER_TYPE", "all")

if WORKER_TYPE == "books":
    # Book worker: chỉ cần ebooklib, beautifulsoup4 (nhẹ)
    include_tasks = [
        "src.tasks.book_tasks",
        "src.tasks.audio_tasks",
    ]
elif WORKER_TYPE == "recommendation":
    # Recommendation worker: cần numpy, scipy, sentence-transformers (nặng)
    include_tasks = ["src.tasks.recommendation_tasks"]
else:
    # Default: load tất cả tasks
    include_tasks = [
        "src.tasks.book_tasks",
        "src.tasks.recommendation_tasks",
        "src.tasks.audio_tasks",
    ]

app = Celery(
    "worker",
    broker=celery_config.broker_url,
    include=include_tasks,
)

app.config_from_object(celery_config)
