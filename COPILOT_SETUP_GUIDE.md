# Zentora Setup Guide for GitHub Copilot

## Quick Start

### Prerequisites
- Docker Desktop (macOS/Windows) or Docker Engine (Linux)
- Git
- Node.js 18+ (for local development, optional)
- 4GB RAM minimum, 8GB recommended

### Setup Commands

**macOS/Linux:**
```bash
./setup.sh
./setup.sh start
```

**Windows:**
```bash
setup.bat setup
setup.bat start
```

---

## Project Structure

```
zentora/
├── backend/                 # FastAPI backend (Python)
│   ├── app/
│   │   ├── main.py         # FastAPI entry point
│   │   ├── models/         # SQLAlchemy models
│   │   ├── core/           # Configuration
│   │   └── db/             # Database session
│   └── requirements.txt
├── frontend-next/          # Next.js frontend (TypeScript/React)
│   ├── pages/              # Next.js pages
│   ├── src/components/     # React components
│   └── package.json
├── iot/                    # IoT firmware
│   ├── esp8266/            # ESP8266 RFID configuration
│   │   └── config.h        # ⚙️ Auto-configured by setup.sh
│   └── *.ino              # Arduino sketches
├── infra/                  # Docker & networking
│   ├── docker-compose.yml
│   ├── Caddyfile           # Web server config
│   └── certs/              # SSL certificates
└── setup.sh / setup.bat    # Installation scripts
```

---

## Architecture Overview

### Deployment Topology

```
Mobile Device (Android/iOS)
         ↓
   WiFi Network
         ↓
   Your Computer (Mac/Windows/Linux)
    IP: 10.25.115.100
         ↓
    Docker Host
         ↓
┌──────────────────────────────────┐
│  Docker Network (10.123.0.0/16)  │
├──────────────────────────────────┤
│  Caddy (Port 80/443)    ←─ Reverse Proxy
│  Frontend (Port 3000)
│  Backend (Port 8000)
│  PostgreSQL (Port 5432)
│  Ganache (Port 8545)
└──────────────────────────────────┘
```

### Services Diagram

- **Caddy** - Reverse proxy, handles HTTP/WebSocket/SSL
- **Next.js Frontend** - User interface (React based)
- **FastAPI Backend** - REST API + WebSocket for alerts
- **PostgreSQL** - Database
- **Ganache** - Ethereum testnet (blockchain)
- **Nginx** - HTTPS proxy on port 8443 (for camera access)

---

## Access URLs

After running `setup.sh start` or `setup.bat start`:

### 📱 **Mobile Access (Same WiFi)**
- **HTTPS (Camera Works):** `https://YOUR.LOCAL.IP:8443`
- **HTTP (Fallback):** `http://YOUR.LOCAL.IP`

### 💻 **Local Access**
- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:8001`
- **API Documentation:** `http://localhost:8001/docs`
- **WebSocket Alerts:** `ws://localhost/ws/alerts`

### 🔧 **IoT Configuration**
Your IP is automatically injected into:
- `iot/esp8266/config.h` → `#define API_BASE_URL "http://YOUR.IP:8001"`

---

## Setup Details

### What the Setup Script Does

1. **Checks Dependencies**
   - Verifies Git is installed
   - Ensures Docker is installed and running
   - Validates docker-compose availability

2. **Clones Repository** (if not present)
   ```bash
   git clone https://github.com/Saketkesar/zentora.git zentora
   ```

3. **Creates Data Directories**
   ```bash
   zentora/data/uploads/
   zentora/data/qr/
   ```

4. **Updates IoT Configuration**
   - Auto-detects your local IP
   - Updates `iot/esp8266/config.h` with corrected `API_BASE_URL`
   - Updates `iot/esp32/config.h` (if exists)

5. **Builds & Starts Services**
   ```bash
   docker compose up -d --build postgres ganache backend frontend caddy
   ```

6. **Displays Access Information**
   - Shows local IP address
   - Displays HTTPS URL for mobile access
   - Shows WebSocket/API endpoints

### Environment Variables

Create `infra/.env` (auto-created from `.env.example`):

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/zentora
JWT_SECRET=your-secret-key-here
GANACHE_RPC_URL=http://ganache:8545
```

---

## Common Commands

### Start Services
```bash
# macOS/Linux
./setup.sh start

# Windows
setup.bat start
```

### Stop Services
```bash
# macOS/Linux
./setup.sh stop

# Windows
setup.bat stop
```

### Restart Services
```bash
# macOS/Linux
./setup.sh restart

# Windows
setup.bat restart
```

### View Logs
```bash
# macOS/Linux
./setup.sh logs

# Windows (view in Docker Desktop or)
docker logs infra-backend-1
```

### Check Status
```bash
# macOS/Linux
./setup.sh status

# Windows
docker ps
```

---

## IoT/ESP8266 Setup

### Configuration File Location
```
iot/esp8266/config.h
```

### Key Values
```c
#define WIFI_SSID "YOUR_WIFI_SSID"         // Set your WiFi name
#define WIFI_PASS "YOUR_WIFI_PASSWORD"     // Set your WiFi password
#define API_BASE_URL "http://192.168.x.x:8001"  // Auto-updated by setup.sh
```

### Flashing Instructions
1. Install Arduino IDE: https://www.arduino.cc/en/software
2. Install ESP8266 board package
3. Open `iot/esp8266/rfid_read_write.ino`
4. Configure WiFi SSID/PASS in `config.h`
5. Select Board: "NodeMCU 1.0 (ESP-12E Module)"
6. Upload to device
7. Check serial monitor for connection status

---

## Networking & IP Management

### Finding Your IP

**macOS/Linux:**
```bash
./setup.sh show-lan-url
# Output: Your IP address
```

**Windows:**
```bash
ipconfig
# Look for IPv4 Address under your WiFi adapter
```

**Android on Same Network:**
1. Open browser
2. Enter: `https://YOUR.IP:8443`
3. Accept self-signed certificate warning
4. Camera access will now prompt for permission

---

## Development Workflow

### Frontend Development
```bash
cd frontend-next
npm install
npm run dev          # Dev server on http://localhost:3000
```

### Backend Development
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # Dev server on http://localhost:8000
```

### Using Docker for Development
```bash
docker compose -f infra/docker-compose.yml up --build
# Services auto-reload on code changes
```

---

## Troubleshooting

### Issue: "Docker not found"
**Solution:**
- Install Docker Desktop from https://www.docker.com/products/docker-desktop
- macOS: Also run: `brew install docker`
- Windows: Run setup.bat as Administrator

### Issue: "Cannot connect to mobile"
**Solution:**
1. Ensure mobile is on same WiFi network
2. Check: `https://YOUR.IP:8443` instead of `http://`
3. Accept the self-signed certificate warning
4. Check firewall settings - port 8443 should be open

### Issue: "Camera not asking for permission"
**Solution:**
- Only HTTPS connections trigger camera permission
- Use `https://YOUR.IP:8443` (with port 8443)
- Accept the certificate warning first
- Try in Chrome browser (best support for media on local IPs)

### Issue: "ESP8266 won't connect to server"
**Solution:**
1. Verify WiFi SSID/Password in config.h
2. Check that ESP8266 and server are on same network
3. Verify API_BASE_URL is correct: `http://YOUR.IP:8001`
4. Check serial monitor for error messages

### Issue: "Port already in use"
**Solution:**
```bash
# Kill processes using ports
./setup.sh stop        # macOS/Linux

# Windows: Use Docker Desktop or
taskkill /F /PID <process_id>
```

---

## Performance Optimization

### For Large-Scale Deployment
1. Increase PostgreSQL buffer pool
2. Enable Redis caching (optional)
3. Use Nginx instead of Caddy for higher throughput
4. Run backend/frontend on separate machines

### Resource Requirements
- **Minimal:** 2GB RAM, 1 CPU core
- **Recommended:** 4GB RAM, 2 CPU cores
- **Production:** 8GB+ RAM, 4 CPU cores

---

## Security Notes

### For Production
1. Replace self-signed certificates with valid SSL certificates
2. Set strong JWT_SECRET in `.env`
3. Use strong database passwords
4. Enable CORS properly for your domain
5. Use HTTPS everywhere (not just port 8443)

### Current Limitations (Development)
- Self-signed certificates (security warning expected)
- Default JWT secret (change in .env)
- No rate limiting
- No DDoS protection

---

## API Reference

### Main Endpoints

**Health Check:**
```bash
GET http://localhost:8001/health
```

**RFID Verification:**
```bash
POST http://localhost:8001/api/rfid/read/verify
Content-Type: application/json

{
  "tourist_uuid": "user-uuid-here",
  "tag_id": "card-tag-id"
}
```

**WebSocket Alerts:**
```
ws://localhost/ws/alerts
```

Full API docs available at: `http://localhost:8001/docs`

---

## Git Workflow

### Push to GitHub

```bash
git add .
git commit -m "Feature: Auto IP detection and Copilot setup guide"
git push origin main
```

### Pull Latest Changes

```bash
./setup.sh stop      # Stop services
git pull             # Get updates
./setup.sh start     # Start with updates
```

---

## Support & Resources

- **Issues/Bugs:** GitHub Issues
- **Documentation:** See README.md
- **API Docs:** http://localhost:8001/docs (after starting)
- **IoT Setup:** See iot/esp8266/FLASHING_GUIDE.md

---

## License

Zentora - Tourist Safety & Management System

---

**Last Updated:** 6 April 2026  
**Version:** 1.0.0
