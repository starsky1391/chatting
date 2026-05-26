@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"

echo ============================================
echo Chat Application - Local Development
echo ============================================
echo.

echo Select startup option:
echo [1] Frontend + Go Backend
echo [2] Go Backend Only
echo [3] Frontend Only
echo [4] Docker Compose
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto frontend_go
if "%choice%"=="2" goto go_backend
if "%choice%"=="3" goto frontend_only
if "%choice%"=="4" goto docker_mode
goto end

:check_go
where go >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Go is not installed. Please install Go 1.23+
    pause
    exit /b 1
)
goto :eof

:check_node
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+
    pause
    exit /b 1
)
goto :eof

:check_docker
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop or Docker Engine.
    pause
    exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose plugin is not available.
    pause
    exit /b 1
)
goto :eof

:: --- Frontend + Go Backend ---
:frontend_go
call :check_go
call :check_node
echo.
echo [1/2] Starting Go Backend on port 3001...
if not exist backend-go\.env (
    echo [INFO] Creating backend-go\.env from backend-go\.env.example...
    copy backend-go\.env.example backend-go\.env >nul
    echo [WARN] Please edit backend-go\.env with your database credentials!
)
start "Chat Backend (Go)" cmd /k "cd /d %~dp0backend-go && go mod tidy && go run cmd/server/main.go"
echo.
echo [2/2] Starting Frontend on port 3000...
if not exist frontend\.env.local (
    echo [INFO] Creating frontend\.env.local from .env.local.example...
    copy frontend\.env.local.example frontend\.env.local >nul
)
start "Chat Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
echo.
echo All systems starting in separate windows!
echo.
echo Prerequisites: PostgreSQL, Redis must be running locally.
echo   Backend: http://localhost:3001
echo   Frontend: http://localhost:3000
goto end

:: --- Go Backend Only ---
:go_backend
call :check_go
echo.
if not exist backend-go\.env (
    echo [INFO] Creating backend-go\.env from backend-go\.env.example...
    copy backend-go\.env.example backend-go\.env >nul
    echo [WARN] Please edit backend-go\.env with your database credentials!
)
echo Starting Go Backend on port 3001...
cd /d %~dp0backend-go
go mod tidy
go run cmd/server/main.go
goto end

:: --- Frontend Only ---
:frontend_only
call :check_node
echo.
if not exist frontend\.env.local (
    echo [INFO] Creating frontend\.env.local from .env.local.example...
    copy frontend\.env.local.example frontend\.env.local >nul
)
echo Starting Frontend on port 3000...
echo Note: Backend must be running on port 3001
cd /d %~dp0frontend
call npm run dev
goto end

:: --- Docker Compose ---
:docker_mode
call :check_docker
echo.
if not exist .env (
    echo [INFO] .env not found, Docker Compose will use the defaults in docker-compose.yml.
    echo [INFO] Create .env only if you need custom ports or passwords.
)
echo Starting Docker stack...
docker compose build --pull
if errorlevel 1 (
    echo [ERROR] Docker image build failed.
    pause
    exit /b 1
)

docker compose up -d --remove-orphans
if errorlevel 1 (
    echo [ERROR] Docker Compose startup failed.
    pause
    exit /b 1
)

echo.
echo Cleaning Docker build cache and dangling images...
docker builder prune -f >nul 2>&1
docker image prune -f >nul 2>&1
echo.
echo Docker stack is starting.
docker compose ps
echo.
echo Access the application at:
echo   HTTP:  http://localhost:8080
echo   HTTPS: https://localhost:8443
goto end

:: --- End ---
:end
echo.
pause
