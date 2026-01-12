from .settings import RABBITMQ_URL


class Queues:
    BOOKS = "books"
    EMAILS = "emails"
    RECOMMENDATIONS = "recommendations"


# Broker
broker_url = RABBITMQ_URL

# Serialization
task_serializer = "json"
accept_content = ["json"]
result_serializer = "json"

# Timezone
timezone = "UTC"
enable_utc = True

# Task settings
task_track_started = True
task_acks_late = True
worker_prefetch_multiplier = 1

# Task routing
task_routes = {
    "src.tasks.book_tasks.*": {"queue": Queues.BOOKS},
    "src.tasks.recommendation_tasks.*": {"queue": Queues.RECOMMENDATIONS},
}

# Celery Beat schedule (periodic tasks)
beat_schedule = {
    # Pre-compute recommendations cho users mỗi 6 giờ
    "precompute-recommendations-6h": {
        "task": "src.tasks.recommendation_tasks.precompute_all_recommendations",
        "schedule": 21600,  # 6 hours
    },
    # Pre-compute similar books mỗi ngày
    "precompute-similar-books-daily": {
        "task": "src.tasks.recommendation_tasks.precompute_similar_books",
        "schedule": 86400,  # 24 hours
    },
}
