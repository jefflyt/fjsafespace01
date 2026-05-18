#!/bin/bash

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_PATH="/Users/jefflee/.nvm/versions/node/v25.2.0/bin"

# Function to clean up on exit
cleanup() {
    echo ""
    echo "Stopping FJDashboard servers..."
    kill $FRONTEND_PID $BACKEND_PID 2>/dev/null
    wait $FRONTEND_PID $BACKEND_PID 2>/dev/null
    exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "Starting FJDashboard..."

# 1. Start Backend
echo "Starting Backend (Port 8000)..."
cd "$SCRIPT_DIR/backend"
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/fj_backend.log 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# 2. Start Frontend
echo "Starting Frontend (Port 3000)..."
cd "$SCRIPT_DIR/frontend"
export PATH="$NODE_PATH:$PATH"
pnpm dev > /tmp/fj_frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "Servers starting..."
echo "   - Frontend: http://localhost:3000"
echo "   - Backend:  http://localhost:8000/docs"
echo ""
echo "Logs: /tmp/fj_backend.log and /tmp/fj_frontend.log"
echo "Press Ctrl+C to stop both servers."

# Keep script running
wait
