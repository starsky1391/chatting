@echo off
echo [1/2] Starting Frontend (Root)...
start cmd /k "cd frontend && npm run dev"

echo [2/2] Starting Backend (./backend)...
start cmd /k "cd backend && npm run dev"

echo All systems are starting up in separate windows!
pause