# Ebook Platform

## Structure

```
├── api/           # NestJS API server
├── worker/        # Python worker for heavy tasks
└── docker-compose.yaml
```

## Development

### API Server
```bash
cd api
npm install
npm run start:dev
```

### Worker
```bash
cd worker
pip install -r requirements.txt
python src/main.py
```

### Docker
```bash
docker-compose up -d
```
