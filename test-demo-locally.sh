#!/bin/bash
# Local Demo Testing Script for HomeScreen Hero
# This script helps you test the demo setup locally before deploying to Railway

set -e

echo "🎬 HomeScreen Hero - Local Demo Test"
echo "===================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Build the Docker image
echo "📦 Building Docker image (this may take 5-10 minutes)..."
docker build -t homescreen-hero-demo:local .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed. Check the output above for errors."
    exit 1
fi

echo "✅ Docker image built successfully"
echo ""

# Create a temporary data directory for local testing
mkdir -p ./demo-data/logs

# Copy demo config to the data directory
if [ -f "config.demo.yaml" ]; then
    cp config.demo.yaml ./demo-data/config.yaml
    echo "✅ Demo config copied to ./demo-data/config.yaml"
else
    echo "⚠️  Warning: config.demo.yaml not found. Using default config."
fi

echo ""
echo "🚀 Starting HomeScreen Hero Demo..."
echo ""
echo "Container will be available at: http://localhost:8000"
echo "Login credentials:"
echo "  Username: admin"
echo "  Password: demo"
echo ""
echo "Press Ctrl+C to stop the container"
echo ""

# Stop and remove existing container if it exists
docker stop homescreen-hero-demo 2>/dev/null || true
docker rm homescreen-hero-demo 2>/dev/null || true

# Run the container
docker run -it --rm \
  --name homescreen-hero-demo \
  -p 8000:8000 \
  -v "$(pwd)/demo-data:/data" \
  -e HSH_AUTH_PASSWORD=demo \
  -e HSH_AUTH_SECRET_KEY=local-demo-secret-key \
  -e HSH_PLEX_TOKEN=mock-token \
  -e HSH_TRAKT_CLIENT_ID=mock-client-id \
  -e HOMESCREEN_HERO_DB=sqlite:////data/homescreen_hero.sqlite \
  -e HOMESCREEN_HERO_LOG_DIR=/data/logs \
  -e HOMESCREEN_HERO_CONFIG=/data/config.yaml \
  homescreen-hero-demo:local

echo ""
echo "✅ Container stopped"
echo ""
echo "📁 Demo data is preserved in ./demo-data/ directory"
echo "   To clean up: rm -rf ./demo-data/"
