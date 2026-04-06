@echo off
setlocal enabledelayedexpansion

set PROJECT_DIR=%~dp0
set APP_DIR=%PROJECT_DIR%zentora
set INFRA_DIR=%APP_DIR%\infra
set COMPOSE_FILE=%INFRA_DIR%\docker-compose.yml
set ENV_FILE=%INFRA_DIR%\.env
set ENV_EXAMPLE=%INFRA_DIR%\.env.example
set LOG_DIR=%PROJECT_DIR%logs
set LAN_IP=127.0.0.1
set CF_LOG=%LOG_DIR%\cloudflared.log

goto :main

:print_header
echo.
echo ===============================================
echo %~1
echo ===============================================
echo.
exit /b 0

:print_success
echo [SUCCESS] %~1
exit /b 0

:print_error
echo [ERROR] %~1
exit /b 0

:print_info
echo [INFO] %~1
exit /b 0

:install_docker
call :print_info "Docker not found. Attempting automatic install..."

where winget >nul 2>nul
if not errorlevel 1 (
    winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        call :print_error "winget Docker install failed"
        exit /b 1
    )
    call :print_info "Docker Desktop installed via winget"
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    timeout /t 8 /nobreak >nul
    exit /b 0
)

where choco >nul 2>nul
if not errorlevel 1 (
    choco install docker-desktop -y
    if errorlevel 1 (
        call :print_error "choco Docker install failed"
        exit /b 1
    )
    call :print_info "Docker Desktop installed via choco"
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    timeout /t 8 /nobreak >nul
    exit /b 0
)

call :print_error "Could not auto-install Docker. Install Docker Desktop manually."
exit /b 1

:install_cloudflared
where cloudflared >nul 2>nul
if not errorlevel 1 exit /b 0

call :print_info "cloudflared not found. Attempting automatic install..."

where winget >nul 2>nul
if not errorlevel 1 (
    winget install -e --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        call :print_error "winget cloudflared install failed"
        exit /b 1
    )
    exit /b 0
)

where choco >nul 2>nul
if not errorlevel 1 (
    choco install cloudflared -y
    if errorlevel 1 (
        call :print_error "choco cloudflared install failed"
        exit /b 1
    )
    exit /b 0
)

call :print_error "Could not auto-install cloudflared. Install it manually and retry."
exit /b 1

:ensure_repo
if not exist "%APP_DIR%\" (
    call :print_info "Cloning repository..."
    git clone https://github.com/Saketkesar/zentora.git "%APP_DIR%"
    if errorlevel 1 (
        call :print_error "Failed to clone repository"
        exit /b 1
    )
    call :print_success "Repository cloned"
)
exit /b 0

:check_dependencies
call :print_header "Checking Docker Dependencies"

where git >nul 2>nul
if errorlevel 1 (
    call :print_error "git not found. Please install Git first."
    exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
    call :install_docker || exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
    call :print_info "Docker Compose not ready yet. Retrying..."
    timeout /t 5 /nobreak >nul
    docker compose version >nul 2>nul
    if errorlevel 1 (
        docker-compose --version >nul 2>nul
        if errorlevel 1 (
            call :print_error "Neither 'docker compose' nor 'docker-compose' found."
            call :print_info "If Docker Desktop was just installed, wait 15-30 seconds and rerun."
            exit /b 1
        )
    )
)

docker info >nul 2>nul
if errorlevel 1 (
    call :print_info "Docker daemon not running yet. Trying to start Docker Desktop..."
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    timeout /t 10 /nobreak >nul
)

docker info >nul 2>nul
if errorlevel 1 (
    call :print_error "Docker daemon is not running. Start Docker and retry."
    exit /b 1
)

call :print_success "Docker is ready"
exit /b 0

:setup_env
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if not exist "%ENV_FILE%" if exist "%ENV_EXAMPLE%" (
    copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
    call :print_success "Created infra/.env from .env.example"
)

if not exist "%APP_DIR%\data\qr" mkdir "%APP_DIR%\data\qr"
if not exist "%APP_DIR%\data\uploads" mkdir "%APP_DIR%\data\uploads"
call :print_success "Ensured data directories exist"
exit /b 0

:compose
docker compose -f "%COMPOSE_FILE%" %*
if errorlevel 1 (
    docker-compose -f "%COMPOSE_FILE%" %*
)
exit /b %errorlevel%

:detect_lan_ip
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } ^| Select-Object -First 1 -ExpandProperty IPAddress)"`) do set LAN_IP=%%i
if "%LAN_IP%"=="" set LAN_IP=127.0.0.1
exit /b 0

:print_access_urls
call :detect_lan_ip
set HTTP_URL=http://%LAN_IP%
set HTTPS_URL=https://%LAN_IP%:8443
call :print_header "ZENTORA SERVICES STARTED"
echo.
echo Mobile Access (Same WiFi Network):
echo   HTTPS (Camera Access): %HTTPS_URL%
echo   HTTP (Fallback):       %HTTP_URL%
echo.
echo Local Access:
echo   Frontend: http://127.0.0.1:3000
echo   Backend API: http://127.0.0.1:8001
echo   API Docs: http://127.0.0.1:8001/docs
echo.
echo Configuration:
echo   Your Local IP: %LAN_IP%
echo   IoT ESP8266 Server: %LAN_IP%:8001
echo.
echo Ready to Use!
exit /b 0

:setup_all
call :print_header "ZENTORA DOCKER SETUP"
call :ensure_repo || exit /b 1
call :check_dependencies || exit /b 1
call :setup_env || exit /b 1

call :print_info "Pulling and building containers (this installs backend/frontend requirements)..."
call :compose pull postgres ganache caddy >nul 2>nul
call :compose build backend frontend
if errorlevel 1 exit /b 1

call :print_header "SETUP COMPLETE"
echo Run: setup.bat start
exit /b 0

:start_all
call :print_header "STARTING ZENTORA (DOCKER)"
call :ensure_repo || exit /b 1
call :check_dependencies || exit /b 1
call :setup_env || exit /b 1

REM Skip nginx by default to avoid host-specific TLS/cert path issues.
call :compose up -d --build postgres ganache backend frontend caddy
if errorlevel 1 exit /b 1
call :print_access_urls
exit /b 0

:stop_all
call :print_header "STOPPING ZENTORA (DOCKER)"
if not exist "%COMPOSE_FILE%" (
    call :print_error "Compose file not found at %COMPOSE_FILE%"
    exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
    call :print_info "Docker CLI not found; skipping container stop"
) else (
    call :compose down --remove-orphans
    if errorlevel 1 call :print_info "Compose down failed; continuing with fallback stop"

    docker rm -f infra-caddy-1 infra-frontend-1 infra-backend-1 infra-postgres-1 infra-ganache-1 >nul 2>nul
)

REM Also stop local dev servers from old non-docker runs.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'uvicorn app.main:app|next dev|npm run dev' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>nul
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'cloudflared tunnel --url http://127.0.0.1:80' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>nul
if exist "%CF_LOG%" del /q "%CF_LOG%" >nul 2>nul
for %%P in (3000 8000 8001 8545) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do taskkill /F /PID %%A >nul 2>nul
)

call :print_success "All containers stopped"
exit /b 0

:restart_all
call :print_header "RESTARTING ZENTORA (DOCKER)"
call :stop_all || exit /b 1
call :start_all || exit /b 1
exit /b 0

:show_status
call :print_header "ZENTORA CONTAINER STATUS"
call :check_dependencies || exit /b 1
call :compose ps
exit /b %errorlevel%

:show_logs
call :print_header "ZENTORA CONTAINER LOGS"
call :check_dependencies || exit /b 1
call :compose logs --tail=120 backend frontend postgres ganache caddy
exit /b %errorlevel%

:show_lan_url
call :check_dependencies || exit /b 1
call :detect_lan_ip
echo http://zentora.%LAN_IP:.=-%.nip.io
exit /b 0

:share_https
call :print_header "STARTING SECURE MOBILE SHARE (HTTPS)"
call :check_dependencies || exit /b 1
call :setup_env || exit /b 1
call :install_cloudflared || exit /b 1

call :compose up -d postgres ganache backend frontend caddy
if errorlevel 1 exit /b 1

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'cloudflared tunnel --url http://127.0.0.1:80' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }" >nul 2>nul
if exist "%CF_LOG%" del /q "%CF_LOG%" >nul 2>nul

start "zentora-cloudflared" /b cmd /c "cloudflared tunnel --url http://127.0.0.1:80 --no-autoupdate > \"%CF_LOG%\" 2>&1"
timeout /t 2 /nobreak >nul

set SHARE_URL=
for /L %%I in (1,1,45) do (
    for /f "usebackq tokens=*" %%U in (`powershell -NoProfile -Command "$m = Select-String -Path '%CF_LOG%' -Pattern 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue; if ($m) { $m.Matches[0].Value }"`) do set SHARE_URL=%%U
    if not "!SHARE_URL!"=="" goto :share_ready
    timeout /t 1 /nobreak >nul
)

call :print_error "Could not fetch secure share URL yet."
call :print_info "Check tunnel logs at %CF_LOG%"
exit /b 1

:share_ready
call :print_success "Secure mobile URL ready"
echo Open on mobile: !SHARE_URL!
echo Note: Camera/location permissions on mobile require HTTPS.
exit /b 0

:show_help
echo.
echo Zentora Docker Setup ^& Service Manager
echo.
echo Usage: setup.bat [command]
echo.
echo Commands:
echo   setup       - Prepare Docker environment and build images
echo   start       - Start app containers
echo   stop        - Stop and remove app containers
echo   restart     - Restart app containers
echo   status      - Show container status
echo   logs        - Show recent container logs
echo   lan-url     - Print Wi-Fi share URL
echo   share       - Start HTTPS URL for mobile camera/location
echo   help        - Show this help message
echo.
echo Examples:
echo   setup.bat setup
echo   setup.bat start
echo   setup.bat stop
echo   setup.bat lan-url
echo   setup.bat share
echo.
exit /b 0

:main
if "%~1"=="" (
    call :show_help
    exit /b 0
)

if /I "%~1"=="setup" (
    call :setup_all
    exit /b %errorlevel%
) else if /I "%~1"=="start" (
    call :start_all
    exit /b %errorlevel%
) else if /I "%~1"=="stop" (
    call :stop_all
    exit /b %errorlevel%
) else if /I "%~1"=="restart" (
    call :restart_all
    exit /b %errorlevel%
) else if /I "%~1"=="status" (
    call :show_status
    exit /b %errorlevel%
) else if /I "%~1"=="logs" (
    call :show_logs
    exit /b %errorlevel%
) else if /I "%~1"=="lan-url" (
    call :show_lan_url
    exit /b %errorlevel%
) else if /I "%~1"=="share" (
    call :share_https
    exit /b %errorlevel%
) else if /I "%~1"=="help" (
    call :show_help
    exit /b 0
) else if /I "%~1"=="--help" (
    call :show_help
    exit /b 0
) else if /I "%~1"=="/?" (
    call :show_help
    exit /b 0
) else (
    call :print_error "Unknown command: %~1"
    call :show_help
    exit /b 1
)

endlocal