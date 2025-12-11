FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libatomic1 nodejs npm && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN prisma generate

CMD ["celery", "-A", "src.celery_app", "worker", "-Q", "books", "-l", "info", "--pool=solo"]
