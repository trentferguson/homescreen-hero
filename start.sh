#!/bin/sh
# Startup script for Railway deployment
# This ensures PORT is properly set and uvicorn starts correctly

# Use Railway's PORT if set, otherwise default to 8000
PORT=${PORT:-8000}

# Auto-restart interval for demo (in seconds, default 6 hours)
RESTART_INTERVAL=${DEMO_RESTART_HOURS:-6}
RESTART_SECONDS=$((RESTART_INTERVAL * 3600))

# Reset demo database to initial state on each startup
echo "Resetting demo database to initial state..."
python3 /app/reset_demo.py || echo "Warning: Failed to reset database, continuing anyway..."

echo "Starting uvicorn on port $PORT"
echo "Demo will auto-restart every $RESTART_INTERVAL hours"

# Start uvicorn in background
uvicorn homescreen_hero.web.app:app --host 0.0.0.0 --port "$PORT" --workers 1 &
UVICORN_PID=$!

# Wait for the specified interval, then exit (Railway will restart)
sleep $RESTART_SECONDS
echo "Auto-restart triggered after $RESTART_INTERVAL hours"
kill $UVICORN_PID 2>/dev/null
exit 0
