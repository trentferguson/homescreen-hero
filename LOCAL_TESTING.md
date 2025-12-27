# Local Testing Guide - HomeScreen Hero Demo

This guide will help you test the demo setup on your local machine before deploying to Railway.

## Prerequisites

- **Docker Desktop** installed and running
  - Download: [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- At least **4GB of free disk space** (for Docker image)
- **10-15 minutes** for the first build

---

## Quick Start

### Option 1: Using the Test Script (Recommended)

**On Windows:**
```bash
# Double-click the file or run from terminal:
test-demo-locally.bat
```

**On Mac/Linux:**
```bash
# Make script executable
chmod +x test-demo-locally.sh

# Run the script
./test-demo-locally.sh
```

The script will:
1. Check if Docker is running
2. Build the Docker image
3. Create a local data directory
4. Copy the demo config
5. Start the container at http://localhost:8000

### Option 2: Manual Docker Commands

If you prefer to run commands manually:

```bash
# 1. Build the Docker image
docker build -t homescreen-hero-demo:local .

# 2. Create data directory
mkdir -p demo-data/logs
cp config.demo.yaml demo-data/config.yaml

# 3. Run the container
docker run -it --rm \
  --name homescreen-hero-demo \
  -p 8000:8000 \
  -v $(pwd)/demo-data:/data \
  -e HSH_AUTH_PASSWORD=demo \
  -e HSH_AUTH_SECRET_KEY=local-demo-secret-key \
  -e HSH_PLEX_TOKEN=mock-token \
  -e HSH_TRAKT_CLIENT_ID=mock-client-id \
  -e HOMESCREEN_HERO_DB=sqlite:////data/homescreen_hero.sqlite \
  -e HOMESCREEN_HERO_LOG_DIR=/data/logs \
  -e HOMESCREEN_HERO_CONFIG=/data/config.yaml \
  homescreen-hero-demo:local
```

**On Windows (PowerShell):**
```powershell
# 3. Run the container (Windows)
docker run -it --rm `
  --name homescreen-hero-demo `
  -p 8000:8000 `
  -v ${PWD}\demo-data:/data `
  -e HSH_AUTH_PASSWORD=demo `
  -e HSH_AUTH_SECRET_KEY=local-demo-secret-key `
  -e HSH_PLEX_TOKEN=mock-token `
  -e HSH_TRAKT_CLIENT_ID=mock-client-id `
  -e HOMESCREEN_HERO_DB=sqlite:////data/homescreen_hero.sqlite `
  -e HOMESCREEN_HERO_LOG_DIR=/data/logs `
  -e HOMESCREEN_HERO_CONFIG=/data/config.yaml `
  homescreen-hero-demo:local
```

---

## Accessing the Demo

Once the container is running, you'll see logs like:
```
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     DEMO MODE: Seeding demo rotation history
INFO:     Created 45 rotation records across 15 rotations
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Open in Browser

Navigate to: **http://localhost:8000**

### Login

- **Username**: `admin`
- **Password**: `demo`

---

## What to Test

### 1. Authentication
- [ ] Login page loads
- [ ] Can login with `admin` / `demo`
- [ ] Invalid credentials show error
- [ ] Logout works
- [ ] Session persists on refresh

### 2. Dashboard
- [ ] Demo banner is visible at the top
- [ ] Health cards show all services as "OK" or "Ready"
- [ ] Recent rotations show 10+ entries with dates
- [ ] Active collections display correctly
- [ ] Scheduler status shows next rotation time

### 3. Manual Rotation
- [ ] Click "Run Rotation Now" button
- [ ] Success toast appears
- [ ] Rotation history updates
- [ ] Active collections change
- [ ] Mock logs show `[MOCK]` prefixed updates

### 4. Simulation
- [ ] Click "Simulate Rotation" button
- [ ] Simulation modal opens
- [ ] Shows selected collections
- [ ] Shows group details
- [ ] "Apply Simulation" button works
- [ ] Modal closes properly

### 5. Collections
- [ ] Navigate to collections page (if available)
- [ ] Can view collection details
- [ ] Mock movie/show data displays

### 6. Configuration
- [ ] Navigate to config page (if available)
- [ ] Config displays correctly
- [ ] Can view collection groups

### 7. Logs
- [ ] Navigate to logs page (if available)
- [ ] Application logs are visible
- [ ] See `[MOCK]` operations logged

---

## Viewing Logs

### Container Logs (Real-time)
The script runs with `-it` so logs appear in your terminal in real-time.

### Application Logs (File)
```bash
# View logs from the data directory
cat demo-data/logs/homescreen_hero.log

# Or tail the logs
tail -f demo-data/logs/homescreen_hero.log
```

### Database Inspection
```bash
# Install sqlite3 if needed
# On Windows: use DB Browser for SQLite (https://sqlitebrowser.org/)
# On Mac: brew install sqlite
# On Linux: apt-get install sqlite3

# Query the database
sqlite3 demo-data/homescreen_hero.sqlite "SELECT * FROM rotation_record LIMIT 10;"
sqlite3 demo-data/homescreen_hero.sqlite "SELECT * FROM collection_usage;"
```

---

## Stopping the Demo

### Using the Script
Press **Ctrl+C** in the terminal where the script is running.

### Manual Stop
```bash
docker stop homescreen-hero-demo
```

---

## Cleaning Up

### Remove Demo Data
```bash
# On Mac/Linux
rm -rf demo-data/

# On Windows
rmdir /s /q demo-data
```

### Remove Docker Image
```bash
docker rmi homescreen-hero-demo:local
```

### Complete Cleanup
```bash
# Stop container, remove image, and delete data
docker stop homescreen-hero-demo 2>/dev/null || true
docker rm homescreen-hero-demo 2>/dev/null || true
docker rmi homescreen-hero-demo:local
rm -rf demo-data/
```

---

## Troubleshooting

### Build Fails

**Issue**: Docker build fails with errors

**Solutions**:
- Ensure Docker Desktop is running
- Check you have enough disk space (4GB+)
- Try cleaning Docker build cache: `docker system prune -a`
- Check Dockerfile syntax hasn't been corrupted

### Container Won't Start

**Issue**: Container exits immediately

**Solutions**:
- Check logs: `docker logs homescreen-hero-demo`
- Verify all environment variables are set
- Ensure port 8000 is not in use: `netstat -an | grep 8000`
- Try a different port: `-p 8001:8000`

### Can't Access http://localhost:8000

**Issue**: Browser shows "connection refused"

**Solutions**:
- Wait 10-20 seconds for the server to fully start
- Check container is running: `docker ps`
- Check container logs for startup errors
- Try `http://127.0.0.1:8000` instead
- Disable VPN if using one

### Login Doesn't Work

**Issue**: Can't login with admin/demo

**Solutions**:
- Check environment variable: `HSH_AUTH_PASSWORD=demo`
- Clear browser cookies/cache
- Try incognito/private browsing window
- Check container logs for authentication errors

### No Demo Data Visible

**Issue**: Rotation history is empty

**Solutions**:
- Check logs for "Seeding demo rotation history" message
- Verify database file exists: `ls -l demo-data/homescreen_hero.sqlite`
- Check for errors during seed: look for "Failed to seed" in logs
- Delete database and restart: `rm demo-data/homescreen_hero.sqlite`

### Port Already in Use

**Issue**: Error "port 8000 is already allocated"

**Solutions**:
```bash
# Use a different port
docker run ... -p 8001:8000 ...
# Then access at http://localhost:8001

# Or find and stop the conflicting process
# Windows: netstat -ano | findstr :8000
# Mac/Linux: lsof -i :8000
```

### Docker Desktop Not Running

**Issue**: "Cannot connect to the Docker daemon"

**Solutions**:
- Start Docker Desktop application
- Wait for Docker to fully initialize (green icon)
- On Windows: Enable WSL 2 backend if prompted
- On Mac: Grant Docker permissions in System Preferences

---

## Performance Notes

### First Build
- Takes **10-15 minutes** (frontend compilation is slow)
- Subsequent builds are faster with Docker cache

### Runtime
- Uses ~**512MB RAM**
- Minimal CPU usage (unless rotating)
- Database file grows to ~**100KB** with demo data

### Build Optimization
If you want faster builds during development:

```dockerfile
# Add to Dockerfile after frontend build
# Cache Python dependencies in a separate layer
FROM python:3.12-slim AS deps
COPY homescreen_hero/requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt
```

---

## Testing Different Scenarios

### Test Authentication Disabled
```bash
# Add to docker run command:
-e HSH_AUTH_ENABLED=false
```

### Test Different Passwords
```bash
# Change password
-e HSH_AUTH_PASSWORD=mypassword
```

### Test Fresh Database
```bash
# Delete database and restart
rm demo-data/homescreen_hero.sqlite
# Container will create and seed a new database
```

### Test Configuration Changes
```bash
# Edit demo-data/config.yaml
# Restart container (it reloads config on startup)
```

---

## Comparing to Railway

The local test should behave identically to Railway deployment:

| Feature | Local | Railway |
|---------|-------|---------|
| Mock APIs | ✅ Yes | ✅ Yes |
| Demo Data | ✅ Seeded | ✅ Seeded |
| Authentication | ✅ admin/demo | ✅ admin/demo |
| Database | ✅ SQLite | ✅ SQLite |
| Logs | ✅ File + stdout | ✅ Railway logs |
| Port | 8000 | Railway assigns |
| Data Persistence | ✅ Volume | ✅ Volume |

---

## Next Steps

Once local testing is successful:

1. ✅ Verify all features work
2. ✅ Check demo banner displays correctly
3. ✅ Confirm mock data is realistic
4. 📝 Note any issues or improvements
5. 🚀 Proceed with Railway deployment (see [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md))

---

## Development Workflow

### Making Changes and Testing

```bash
# 1. Make code changes
vim homescreen_hero/core/integrations/mock_plex_client.py

# 2. Rebuild image
docker build -t homescreen-hero-demo:local .

# 3. Restart container
docker stop homescreen-hero-demo
./test-demo-locally.sh  # or .bat on Windows

# 4. Test changes at http://localhost:8000
```

### Frontend-Only Changes

```bash
# For faster frontend iteration:
cd homescreen-hero-ui
npm run dev  # Runs Vite dev server on :5173

# Update vite.config.ts to proxy API calls:
# proxy: { '/api': 'http://localhost:8000' }
```

---

Happy Testing! 🎬

For Railway deployment, see [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)
