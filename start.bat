@echo off
chcp 65001 >nul 2>&1
echo ============================================
echo Chat Application - Local Development
echo ============================================
echo.

:: Check prerequisites
where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Go is not installed. Please install Go 1.23+
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+
    pause
    exit /b 1
)

echo Select startup option:
echo [1] Frontend + Go Backend
echo [2] Go Backend Only
echo [3] Frontend Only
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" goto frontend_go
if "%choice%"=="2" goto go_backend
if "%choice%"=="3" goto frontend_only
goto end

:: --- Frontend + Go Backend ---
:frontend_go
echo.
echo [1/2] Starting Go Backend on port 3001...
if not exist backend-go\.env (
    echo [INFO] Creating backend-go\.env from .env.example...
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
echo.
if not exist backend-go\.env (
    echo [INFO] Creating backend-go\.env from .env.example...
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

:: --- End ---
:end
echo.
pause
