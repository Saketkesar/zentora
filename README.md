# Zentora

Zentora is a smart tourist safety monitoring platform with role-based dashboards (Admin, Police, Tourist), geofencing, KYC flows, ID management, and map-oriented monitoring.

This repository is now Docker-first and supports the same setup/start/stop workflow on Windows, macOS, and Linux.

## Tech Stack

- Frontend: Next.js (TypeScript), Tailwind CSS, React, i18n (EN/HI)
- Backend: FastAPI, SQLAlchemy, Pydantic, Uvicorn
- Database: PostgreSQL 16
- Blockchain local node: Ganache
- Reverse proxy/LAN gateway: Caddy
- Orchestration: Docker Compose

## Repository Structure

- `frontend-next` - Next.js application and dashboards
- `backend` - FastAPI application
- `infra` - Docker Compose, Caddy, Nginx configs
- `data` - Uploaded assets and generated data mounts
- `iot` - RFID/IoT firmware sketches
- `setup.sh` - Cross-platform script for macOS/Linux
- `setup.bat` - Cross-platform script for Windows

## Prerequisites

- Git
- Docker Desktop (Windows/macOS) or Docker Engine + Compose Plugin (Linux)

Verify:

```bash
docker --version
docker compose version
```

## Quick Start (Script-Based)

1. Clone repository

```bash
git clone https://github.com/Saketkesar/zentora.git
cd zentora
```

2. Use the platform script

macOS/Linux:

```bash
chmod +x setup.sh
./setup.sh setup
./setup.sh start
```

Windows (Command Prompt or PowerShell):

```bat
setup.bat setup
setup.bat start
```

3. Open app

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8001`
- Swagger Docs: `http://localhost:8001/docs`

## Script Commands

### setup.sh (macOS/Linux)

```bash
./setup.sh setup
./setup.sh start
./setup.sh stop
./setup.sh restart
./setup.sh status
./setup.sh logs
./setup.sh lan-url
./setup.sh share
./setup.sh help
```

### setup.bat (Windows)

```bat
setup.bat setup
setup.bat start
setup.bat stop
setup.bat restart
setup.bat status
setup.bat logs
setup.bat lan-url
setup.bat share
setup.bat help
```

## Direct Docker Commands (Alternative)

Use this if you do not want scripts.

```bash
cd infra
docker compose up -d --build postgres ganache backend frontend caddy
docker compose ps
docker compose logs -f backend frontend
docker compose down --remove-orphans
```

## Service Control

Start:

```bash
docker compose up -d --build postgres ganache backend frontend caddy
```

Stop:

```bash
docker compose down --remove-orphans
```

Restart:

```bash
docker compose down --remove-orphans
docker compose up -d --build postgres ganache backend frontend caddy
```

Status:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs -f backend frontend postgres ganache caddy
```

## Default Credentials

- Admin: `admin@zentora.local` / `Admin@12345`
- Police: `police@zentora.local` / `Police@12345`

## LAN and Mobile Access

- LAN gateway is served by Caddy on port `80`.
- For mobile camera/location permissions, prefer HTTPS tunnel sharing (for example cloudflared) instead of plain HTTP hostnames.
- `nip.io` over HTTP may load pages but can block camera/geolocation permissions on many mobile browsers.

## Troubleshooting

If login returns `Not Found` on hostname routes:

```bash
cd infra
docker compose restart caddy
```

If login returns `invalid credentials` after rebuilds:

```bash
cd infra
docker compose build --no-cache backend
docker compose up -d backend
```

If ports are already in use:

- Stop old containers and retry:

```bash
docker compose down --remove-orphans
```

## Notes

- Current repo is optimized for Docker deployment across OSes.
- Legacy local venv/npm-only setup is not required for normal usage.