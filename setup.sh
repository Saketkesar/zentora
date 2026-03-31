#!/usr/bin/env bash

set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$PROJECT_DIR/zentora"
INFRA_DIR="$APP_DIR/infra"
COMPOSE_FILE="$INFRA_DIR/docker-compose.yml"
ENV_FILE="$INFRA_DIR/.env"
ENV_EXAMPLE="$INFRA_DIR/.env.example"
LOG_DIR="$PROJECT_DIR/logs"
COMPOSE_IMPL=""
CLOUDFLARED_PID_FILE="$LOG_DIR/cloudflared.pid"

get_lan_ip() {
    local ip=""

    if [ "$(uname -s)" = "Darwin" ]; then
        ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
        if [ -z "$ip" ]; then
            ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
        fi
    elif command -v hostname >/dev/null 2>&1; then
        ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    fi

    if [ -z "$ip" ]; then
        ip="127.0.0.1"
    fi

    echo "$ip"
}

print_access_urls() {
    local lan_ip
    lan_ip="$(get_lan_ip)"
    local wifi_url="http://zentora.${lan_ip//./-}.nip.io"

    print_header "SERVICES STARTED"
    echo -e "${GREEN}Local Frontend:${NC} ${YELLOW}http://127.0.0.1:3000${NC}"
    echo -e "${GREEN}Local Backend:${NC} ${YELLOW}http://127.0.0.1:8001${NC}"
    echo -e "${GREEN}Local API Docs:${NC} ${YELLOW}http://127.0.0.1:8001/docs${NC}"
    echo -e "${GREEN}Wi-Fi Share URL:${NC} ${YELLOW}${wifi_url}${NC}"
    echo -e "${GREEN}Wi-Fi API Docs:${NC} ${YELLOW}${wifi_url}/api/docs${NC}"
}

print_header() {
    echo -e "${BLUE}===============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===============================================${NC}"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${YELLOW}→ $1${NC}"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

wait_for_docker_daemon() {
    local attempts="${1:-30}"
    local wait_secs="${2:-2}"
    local i

    for i in $(seq 1 "$attempts"); do
        if docker info >/dev/null 2>&1; then
            return 0
        fi
        sleep "$wait_secs"
    done
    return 1
}

repair_macos_compose_plugin() {
    [ "$(uname -s)" = "Darwin" ] || return 0

    mkdir -p "$HOME/.docker/cli-plugins"

    for candidate in \
        "/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose" \
        "/usr/local/cli-plugins/docker-compose" \
        "/opt/homebrew/lib/docker/cli-plugins/docker-compose"; do
        if [ -x "$candidate" ]; then
            ln -sf "$candidate" "$HOME/.docker/cli-plugins/docker-compose"
            return 0
        fi
    done

    return 0
}

resolve_compose_impl() {
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_IMPL="plugin"
        return 0
    fi

    if command -v docker-compose >/dev/null 2>&1 && docker-compose --version >/dev/null 2>&1; then
        COMPOSE_IMPL="standalone"
        return 0
    fi

    return 1
}

install_docker_linux() {
    print_info "Attempting automatic Docker installation for Linux..."

    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y ca-certificates curl gnupg lsb-release
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
          sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    elif command -v dnf >/dev/null 2>&1; then
        sudo dnf -y install dnf-plugins-core
        sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
        sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    elif command -v yum >/dev/null 2>&1; then
        sudo yum -y install yum-utils
        sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        sudo yum -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -Sy --noconfirm docker docker-compose
    elif command -v zypper >/dev/null 2>&1; then
        sudo zypper --non-interactive install docker docker-compose
    else
        print_error "Unsupported Linux package manager. Install Docker manually and rerun."
        exit 1
    fi

    sudo systemctl enable docker >/dev/null 2>&1 || true
    sudo systemctl start docker >/dev/null 2>&1 || true
}

install_docker_macos() {
    print_info "Attempting automatic Docker installation for macOS..."

    if command -v brew >/dev/null 2>&1; then
        brew install --cask docker
        open -a Docker || true
        print_info "Docker Desktop installed. Wait until Docker reports Engine running, then rerun if needed."
    else
        print_error "Homebrew not found. Install Homebrew first or install Docker Desktop manually."
        exit 1
    fi
}

ensure_docker_installed() {
    if command -v docker >/dev/null 2>&1; then
        return 0
    fi

    print_info "Docker not found. Installing automatically..."

    case "$(uname -s)" in
        Darwin) install_docker_macos ;;
        Linux) install_docker_linux ;;
        *)
            print_error "Unsupported OS for automatic Docker install. Install Docker manually."
            exit 1
            ;;
    esac

    if ! command -v docker >/dev/null 2>&1; then
        print_error "Docker installation did not complete successfully."
        exit 1
    fi
}

install_cloudflared_linux() {
    if command_exists apt-get; then
        sudo apt-get update
        sudo apt-get install -y cloudflared
    elif command_exists dnf; then
        sudo dnf -y install cloudflared
    elif command_exists yum; then
        sudo yum -y install cloudflared
    elif command_exists pacman; then
        sudo pacman -Sy --noconfirm cloudflared
    elif command_exists zypper; then
        sudo zypper --non-interactive install cloudflared
    else
        print_error "Unsupported Linux package manager for cloudflared."
        exit 1
    fi
}

install_cloudflared() {
    if command_exists cloudflared; then
        return 0
    fi

    print_info "cloudflared not found. Installing automatically..."

    case "$(uname -s)" in
        Darwin)
            if command_exists brew; then
                brew install cloudflared
            else
                print_error "Homebrew not found. Install cloudflared manually."
                exit 1
            fi
            ;;
        Linux)
            install_cloudflared_linux
            ;;
        *)
            print_error "Unsupported OS for automatic cloudflared install."
            exit 1
            ;;
    esac

    if ! command_exists cloudflared; then
        print_error "cloudflared installation did not complete successfully."
        exit 1
    fi
}

ensure_repo() {
    if [ ! -d "$APP_DIR" ]; then
        print_info "Cloning repository..."
        git clone https://github.com/Saketkesar/zentora.git "$APP_DIR"
        print_success "Repository cloned"
    fi
}

check_dependencies() {
    print_header "Checking Docker Dependencies"

    if ! command -v git >/dev/null 2>&1; then
        print_error "git not found. Please install git first."
        exit 1
    fi

    ensure_docker_installed

    if ! docker info >/dev/null 2>&1; then
        print_info "Docker daemon not running yet. Trying to start..."
        if [ "$(uname -s)" = "Darwin" ]; then
            open -a Docker || true
            wait_for_docker_daemon 45 2 || true
        else
            sudo systemctl start docker >/dev/null 2>&1 || true
            wait_for_docker_daemon 20 1 || true
        fi
    fi

    if ! wait_for_docker_daemon 8 1; then
        print_error "Docker daemon is not running. Start Docker and try again."
        exit 1
    fi

    repair_macos_compose_plugin

    if ! resolve_compose_impl; then
        print_info "Docker Compose not ready yet. Retrying while Docker Desktop finishes initialization..."
        sleep 3
        repair_macos_compose_plugin
        if ! resolve_compose_impl; then
            print_error "Neither 'docker compose' nor 'docker-compose' is usable yet."
            print_info "If Docker Desktop was just installed, wait 15-30 seconds and rerun."
            exit 1
        fi
    fi

    if [ "$COMPOSE_IMPL" = "plugin" ]; then
        print_success "docker compose found"
    else
        print_success "docker-compose found"
    fi

    print_success "Docker daemon is running"
}

compose() {
    if [ "$COMPOSE_IMPL" = "plugin" ]; then
        docker compose -f "$COMPOSE_FILE" "$@"
    elif [ "$COMPOSE_IMPL" = "standalone" ]; then
        docker-compose -f "$COMPOSE_FILE" "$@"
    else
        print_error "Docker Compose is not available."
        exit 1
    fi
}

setup_env() {
    mkdir -p "$LOG_DIR"

    if [ ! -f "$ENV_FILE" ] && [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        print_success "Created infra/.env from .env.example"
    fi

    mkdir -p "$APP_DIR/data/qr" "$APP_DIR/data/uploads"
    print_success "Ensured data directories exist"
}

setup_all() {
    print_header "ZENTORA DOCKER SETUP"
    ensure_repo
    check_dependencies
    setup_env

    print_info "Pulling and building containers (this installs backend/frontend requirements)..."
    compose pull postgres ganache caddy || true
    compose build backend frontend

    print_header "SETUP COMPLETE"
    echo -e "${GREEN}Run:${NC} ${YELLOW}./setup.sh start${NC}"
}

start_all() {
    print_header "STARTING ZENTORA (DOCKER)"
    ensure_repo
    check_dependencies
    setup_env

    # Skip nginx by default to avoid host-specific TLS/cert path issues.
    compose up -d --build postgres ganache backend frontend caddy

    print_access_urls
}

stop_all() {
    print_header "STOPPING ZENTORA (DOCKER)"
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "Compose file not found at $COMPOSE_FILE"
        exit 1
    fi

    if command -v docker >/dev/null 2>&1; then
        repair_macos_compose_plugin
        if resolve_compose_impl; then
            compose down --remove-orphans || true
        else
            print_info "Compose command not available yet; skipping compose down"
        fi

        if docker info >/dev/null 2>&1; then
            docker rm -f infra-caddy-1 infra-frontend-1 infra-backend-1 infra-postgres-1 infra-ganache-1 >/dev/null 2>&1 || true
        fi
    else
        print_info "Docker CLI not found; skipping container stop"
    fi

    # Also stop any local dev servers from old non-docker runs.
    pkill -f "uvicorn app.main:app" >/dev/null 2>&1 || true
    pkill -f "next dev" >/dev/null 2>&1 || true
    pkill -f "npm run dev" >/dev/null 2>&1 || true

    for p in 3000 8000 8001 8545; do
        lsof -ti tcp:"$p" | xargs kill -9 >/dev/null 2>&1 || true
    done

    pkill -f "cloudflared tunnel --url http://127.0.0.1:80" >/dev/null 2>&1 || true
    rm -f "$CLOUDFLARED_PID_FILE" >/dev/null 2>&1 || true

    print_success "All containers stopped"
}

restart_all() {
    print_header "RESTARTING ZENTORA (DOCKER)"
    stop_all
    start_all
}

show_status() {
    print_header "ZENTORA CONTAINER STATUS"
    check_dependencies
    compose ps
}

show_logs() {
    print_header "ZENTORA CONTAINER LOGS"
    check_dependencies
    compose logs --tail=120 backend frontend postgres ganache caddy
}

show_lan_url() {
    check_dependencies
    local lan_ip
    lan_ip="$(get_lan_ip)"
    echo "http://zentora.${lan_ip//./-}.nip.io"
}

share_https() {
    print_header "STARTING SECURE MOBILE SHARE (HTTPS)"
    check_dependencies
    setup_env
    install_cloudflared

    compose up -d postgres ganache backend frontend caddy

    mkdir -p "$LOG_DIR"
    pkill -f "cloudflared tunnel --url http://127.0.0.1:80" >/dev/null 2>&1 || true

    local log_file="$LOG_DIR/cloudflared.log"
    nohup cloudflared tunnel --url http://127.0.0.1:80 --no-autoupdate >"$log_file" 2>&1 &
    local tunnel_pid=$!
    echo "$tunnel_pid" > "$CLOUDFLARED_PID_FILE"

    local url=""
    local i
    for i in $(seq 1 30); do
        url="$(grep -Eo 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' "$log_file" | head -n1 || true)"
        if [ -n "$url" ]; then
            break
        fi
        sleep 1
    done

    if [ -z "$url" ]; then
        print_error "Could not fetch secure share URL yet."
        print_info "Check tunnel logs at: $log_file"
        exit 1
    fi

    print_success "Secure mobile URL ready"
    echo -e "${GREEN}Open on mobile:${NC} ${YELLOW}$url${NC}"
    echo -e "${GREEN}Note:${NC} Camera/location permissions on mobile require HTTPS."
}

show_help() {
    echo ""
    echo -e "${BLUE}Zentora Docker Setup & Service Manager${NC}"
    echo ""
    echo -e "${YELLOW}Usage: ./setup.sh [command]${NC}"
    echo ""
    echo -e "${GREEN}Commands:${NC}"
    echo -e "  ${YELLOW}setup${NC}       - Prepare Docker environment and build images"
    echo -e "  ${YELLOW}start${NC}       - Start app containers"
    echo -e "  ${YELLOW}stop${NC}        - Stop and remove app containers"
    echo -e "  ${YELLOW}restart${NC}     - Restart app containers"
    echo -e "  ${YELLOW}status${NC}      - Show container status"
    echo -e "  ${YELLOW}logs${NC}        - Show recent container logs"
    echo -e "  ${YELLOW}lan-url${NC}     - Print Wi-Fi share URL"
    echo -e "  ${YELLOW}share${NC}       - Start HTTPS URL for mobile camera/location"
    echo -e "  ${YELLOW}help${NC}        - Show this help message"
    echo ""
    echo -e "${GREEN}Examples:${NC}"
    echo -e "  ${YELLOW}./setup.sh setup${NC}"
    echo -e "  ${YELLOW}./setup.sh start${NC}"
    echo -e "  ${YELLOW}./setup.sh stop${NC}"
    echo -e "  ${YELLOW}./setup.sh lan-url${NC}"
    echo -e "  ${YELLOW}./setup.sh share${NC}"
}

main() {
    case "${1:-help}" in
        setup) setup_all ;;
        start) start_all ;;
        stop) stop_all ;;
        restart) restart_all ;;
        status) show_status ;;
        logs) show_logs ;;
        lan-url) show_lan_url ;;
        share) share_https ;;
        help|--help|-h) show_help ;;
        *)
            print_error "Unknown command: ${1}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"