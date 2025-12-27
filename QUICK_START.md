# HomeScreen Hero Demo - Quick Start Guide

## 🎯 You're on the Demo Branch!

This branch (`homescreen-hero-demo-setup`) contains a fully working demo with mocked Plex and Trakt APIs.

---

## 🚀 Test Locally (5 minutes)

**The fastest way to see the demo in action:**

### Windows:
```bash
test-demo-locally.bat
```

### Mac/Linux:
```bash
chmod +x test-demo-locally.sh
./test-demo-locally.sh
```

Then open: **http://localhost:8000**
- Username: `admin`
- Password: `demo`

📖 Full guide: [LOCAL_TESTING.md](LOCAL_TESTING.md)

---

## ☁️ Deploy to Railway (10 minutes)

### Option 1: Railway Dashboard
1. Go to [railway.app/new](https://railway.app/new)
2. Choose "Deploy from GitHub repo"
3. Select this repository + `homescreen-hero-demo-setup` branch
4. Add environment variables (see below)
5. Add a `/data` volume
6. Deploy!

### Option 2: Railway CLI
```bash
railway login
railway link
railway up
```

📖 Full guide: [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)

### Required Environment Variables:
```bash
HSH_AUTH_PASSWORD=demo
HSH_AUTH_SECRET_KEY=railway-demo-secret-key-change-me
HSH_PLEX_TOKEN=demo-mock-token
HSH_TRAKT_CLIENT_ID=demo-mock-client-id
HOMESCREEN_HERO_DB=sqlite:////data/homescreen_hero.sqlite
HOMESCREEN_HERO_LOG_DIR=/data/logs
HOMESCREEN_HERO_CONFIG=/data/config.yaml
```

---

## 📦 What's Included

### Mock Data
- ✅ **13+ Collections**: Oscar Winners, 80s Action, Ghibli, HBO Dramas, etc.
- ✅ **15 Pre-seeded Rotations**: Spanning 30 days of history
- ✅ **30+ Movies & Shows**: Realistic sample library
- ✅ **Demo Banner**: Clear indication this is a demo

### Features You Can Test
- ✅ Manual rotation triggering
- ✅ Rotation simulation (dry-run mode)
- ✅ Rotation history browsing
- ✅ Collection group management
- ✅ Health monitoring
- ✅ Authentication system
- ✅ Configuration viewing

### What's Mocked
- 🎭 Plex server connections
- 🎭 Trakt API calls
- 🎭 Collection visibility updates

---

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| [LOCAL_TESTING.md](LOCAL_TESTING.md) | Complete local testing guide with troubleshooting |
| [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md) | Step-by-step Railway deployment |
| [DEMO_SETUP_SUMMARY.md](DEMO_SETUP_SUMMARY.md) | Technical implementation details |
| [config.demo.yaml](config.demo.yaml) | Demo configuration file |

---

## 🔧 Configuration Files

- **`test-demo-locally.bat`** - Windows test script
- **`test-demo-locally.sh`** - Mac/Linux test script
- **`config.demo.yaml`** - Demo configuration with sample groups
- **`.env.railway`** - Railway environment template
- **`railway.json`** - Railway deployment config

---

## ⚡ Common Commands

### Local Testing
```bash
# Start demo
./test-demo-locally.sh

# View logs
tail -f demo-data/logs/homescreen_hero.log

# Clean up
rm -rf demo-data/
docker rmi homescreen-hero-demo:local
```

### Railway Deployment
```bash
# Deploy
railway up

# View logs
railway logs

# Open in browser
railway open
```

---

## 🎬 What Happens When You Run It

1. **Database initializes** - SQLite database created at `/data/homescreen_hero.sqlite`
2. **Demo data seeds** - 15 rotations and collection usage stats populated
3. **Mock services start** - Plex and Trakt mocks replace real APIs
4. **Scheduler starts** - Rotations will run every 6 hours automatically
5. **Frontend serves** - React UI available at port 8000
6. **You're ready!** - Login and explore the demo

---

## 🐛 Troubleshooting

### Docker Issues
```bash
# Check Docker is running
docker info

# Clean Docker cache
docker system prune -a
```

### Port Conflicts
```bash
# Use different port
docker run -p 8001:8000 ...
```

### Fresh Start
```bash
# Delete everything and rebuild
docker stop homescreen-hero-demo
docker rm homescreen-hero-demo
rm -rf demo-data/
docker rmi homescreen-hero-demo:local
./test-demo-locally.sh
```

---

## 📝 Next Steps

1. ✅ Run local test: `./test-demo-locally.sh`
2. ✅ Verify demo works at http://localhost:8000
3. ✅ Check all features (rotation, simulation, history)
4. 🚀 Deploy to Railway
5. 🌐 Share the demo URL!

---

## ❓ Need Help?

- **Local testing issues**: See [LOCAL_TESTING.md](LOCAL_TESTING.md)
- **Railway deployment**: See [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)
- **Implementation details**: See [DEMO_SETUP_SUMMARY.md](DEMO_SETUP_SUMMARY.md)
- **GitHub Issues**: Open an issue if you find a bug

---

**Happy demoing!** 🎉
