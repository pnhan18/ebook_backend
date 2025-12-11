from celery import Celery
from dotenv import load_dotenv

load_dotenv()

from src.config import celery_config

app = Celery(
    "worker",
    broker=celery_config.broker_url,
    include=["src.tasks.book_tasks"],
)

app.config_from_object(celery_config)
