@echo off
echo ========================================
echo   DOVIC AI Restaurant OS - Startup
echo ========================================

echo.
echo [1/4] Setting up backend environment...
if not exist backend\.env (
    copy backend\.env.example backend\.env
    echo Created backend\.env from example
)

echo.
echo [2/4] Installing backend dependencies...
cd backend
pip install -r requirements.txt --quiet

echo.
echo [3/4] Seeding demo data...
python seed.py

echo.
echo [4/4] Starting servers...
start "DOVIC Backend" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
cd ..\frontend

echo Installing frontend dependencies...
call npm install --silent

start "DOVIC Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo   DOVIC AI is running!
echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo   Demo Login:
echo   Email: owner@spicetrail.com
echo   Pass:  demo1234
echo ========================================
pause
