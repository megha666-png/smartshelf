#!/usr/bin/env bash
# SmartShelf Unified Launcher Script
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "[SmartShelf] Quiet Intelligence for Everyday Living"
echo "[Info] Project Directory: $(pwd)"

export PYTHONPATH="$DIR:$DIR/..:$PYTHONPATH"

# Free port 8000 if lingering process exists
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "[Port] Freeing lingering process on port 8000..."
    lsof -ti :8000 | xargs kill -9 2>/dev/null || true
    sleep 0.5
fi

# Check if uvicorn is installed
if python3 -c "import uvicorn, fastapi" 2>/dev/null; then
    echo "[Server] Starting FastAPI server with Uvicorn..."
    echo "[Server] Running live on: http://localhost:8000"
    exec python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "[Server] Starting SmartShelf with high-performance native server..."
    echo "[Server] Running live on: http://localhost:8000"
    exec python3 backend/standalone_server.py 8000
fi
