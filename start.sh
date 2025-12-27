#!/bin/sh
# Startup script for Railway deployment
# This ensures PORT is properly set and uvicorn starts correctly

# Use Railway's PORT if set, otherwise default to 8000
PORT=${PORT:-8000}

echo "Starting uvicorn on port $PORT"
exec uvicorn homescreen_hero.web.app:app --host 0.0.0.0 --port "$PORT" --workers 1
