# ============================
# 1) Build the Vite frontend
# ============================
FROM node:20-alpine AS ui-build
WORKDIR /ui

# Install dependencies
COPY homescreen-hero-ui/package*.json ./
RUN npm ci

# Copy source and build
COPY homescreen-hero-ui/ ./
RUN npm run build
# Build output: /ui/dist


# ============================
# 2) Python runtime image
# ============================
FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Optional: curl for healthchecks / debugging
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY homescreen_hero/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code
COPY homescreen_hero/ /app/homescreen_hero/

# Copy built frontend into the exact folder FastAPI serves
# (your FastAPI expects: homescreen_hero/web/frontend/index.html)
RUN mkdir -p /app/homescreen_hero/web/frontend
COPY --from=ui-build /ui/dist/ /app/homescreen_hero/web/frontend/

# Copy demo configuration file
COPY config.demo.yaml /app/config.demo.yaml

# Copy demo reset script
COPY reset_demo.py /app/reset_demo.py

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8000

# Set default port (Railway will override with $PORT env var)
ENV PORT=8000

# Demo-specific environment variables (baked into image for Railway demo)
ENV HOMESCREEN_HERO_CONFIG=/app/config.demo.yaml \
    HSH_PLEX_TOKEN=demo-mock-token-not-real \
    HSH_AUTH_PASSWORD=demo \
    HSH_AUTH_SECRET_KEY=railway-demo-secret-key-change-me-in-production \
    HSH_TRAKT_CLIENT_ID=demo-mock-trakt-client-id \
    HOMESCREEN_HERO_DB=sqlite:////data/homescreen_hero.sqlite \
    HOMESCREEN_HERO_LOG_DIR=/data/logs \
    DEMO_RESTART_HOURS=6

# IMPORTANT: single worker recommended (APScheduler runs in-process)
CMD ["/app/start.sh"]
