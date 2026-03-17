# Zentora Setup Guide

This guide runs Zentora so people on the same local network can access it.

## 1) Requirements

- macOS/Linux with:
  - `python3`
  - `node` + `npm`
- Optional: Docker (not required for this guide)

## 2) Project Location

Use the writable project copy:

```zsh
cd /tmp/port_88_zentora_rw
```

## 3) Backend Setup (FastAPI)

Install backend dependencies:

```zsh
python3 -m pip install --user --break-system-packages \
  fastapi 'uvicorn[standard]' python-multipart pydantic pydantic-settings \
  SQLAlchemy 'psycopg[binary]' 'passlib[bcrypt]' PyJWT 'qrcode[pil]' web3 'bcrypt==4.0.1'
```

Start backend (bind all interfaces):

```zsh
cd /tmp/port_88_zentora_rw
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=backend DATABASE_URL='sqlite:////tmp/zentora.db' \
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Backend URLs:

- Local machine: `http://127.0.0.1:8000/docs`
- LAN devices: `http://your_ip:8000/docs`

## 4) Frontend Setup (Next.js)

Install frontend dependencies:

```zsh
cd /tmp/port_88_zentora_rw/frontend-next
npm install
```

Start frontend (bind all interfaces):

```zsh
cd /tmp/port_88_zentora_rw/frontend-next
NEXT_PUBLIC_API_BASE='http://127.0.0.1:8000' npm run dev -- --hostname 0.0.0.0 --port 3000
```

Frontend URLs:

- Local machine: `http://127.0.0.1:3000`
- LAN devices: `http://Your_Ip3000`

## 5) LAN Access Checklist

- All phones/laptops must be on the same Wi-Fi/LAN.
- macOS Firewall must allow incoming connections for terminal/node/python.
- Router/client isolation must be disabled (if enabled, devices cannot see each other).

Quick test from another device browser:

- `http://Your_IP:3000`
- `http://YOUR_IP:8000/docs`

## 6) Default Test Credentials

- Admin: `admin@zentora.local` / `Admin@12345`
- Police: `police@zentora.local` / `Police@12345`

## 7) Stop Services

Use terminal where each service runs and press `Ctrl+C`.

If needed:

```zsh
pkill -f 'uvicorn app.main:app' || true
pkill -f 'next dev' || true
```
