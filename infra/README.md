# Infra

Docker Compose orchestration for local dev.

## Quick start

```zsh
cd infra
cp .env.example .env
# edit .env if needed
docker compose up --build
```

Services
- frontend-next → http://localhost:3000
- backend → http://localhost:8000
- postgres → localhost:5432
- ganache (optional) → http://localhost:8545
