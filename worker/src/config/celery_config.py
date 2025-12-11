from .settings import RABBITMQ_URL


class Queues:
    BOOKS = "books"
    EMAILS = "emails"


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
}
