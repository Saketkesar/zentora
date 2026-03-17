# Zentora

Zentora is a Smart Tourist Safety Monitoring System (mobile-first PWA + admin + police dashboards) built per the provided specs. This repo includes a Next.js frontend and a FastAPI backend. No dummy/seed data is included.

## Structure

- `frontend-next` – Next.js (TypeScript), Tailwind CSS, lucide icons, simple i18n (EN/HI)
- `backend` – FastAPI app with initial route skeletons
- `infra` – Docker Compose for local services
- `data` – Storage mount points (images, db volumes)

Logo: uses external URL `https://port88drops.netlify.app/PORT_88.svg` in the UI.

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker (optional, for compose)

## Run locally (frontend)

```zsh
cd frontend-next
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run locally (backend)

```zsh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/docs`.

## Run via Docker Compose

```zsh
cd infra
cp .env.example .env
docker compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Postgres: `localhost:5432` (no seed, empty)

## Notes
- No seeded data included, no PII. Endpoints exist but return structural responses.
- Localization files: `frontend-next/locales/en.json`, `frontend-next/locales/hi.json`.
- Add SSL/TLS and DB encryption for LAN deployment as per spec.

## Next steps
- Implement full API spec and DB models.
- Add PWA service worker and offline tiles.
- Wire WebSocket events and map features.