#!/bin/bash
set -e

echo "========================================"
echo "  DOVIC AI Restaurant OS - Startup"
echo "========================================"

# Backend setup
echo ""
echo "[1/4] Setting up backend environment..."
cd backend
[ ! -f .env ] && cp .env.example .env && echo "Created .env"

echo "[2/4] Installing backend dependencies..."
pip install -r requirements.txt -q

echo "[3/4] Seeding demo data..."
python seed.py 2>/dev/null || true

echo "[4/4] Starting backend..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd ../frontend
echo "Installing frontend dependencies..."
npm install --silent

echo "Starting frontend..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  DOVIC AI is running!"
echo ""
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "  Demo Login:"
echo "  Email: owner@spicetrail.com"
echo "  Pass:  demo1234"
echo "========================================"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
