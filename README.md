# HomeScreen Hero - Demo Branch

> **Note**: You are on the `homescreen-hero-demo-setup` branch - a fully functional demo with mocked APIs.

## 🎯 What is This?

This is a **demo version** of HomeScreen Hero designed for:
- 🌐 **Public demos** on Railway or other hosting platforms
- 🧪 **Testing the UI** without a real Plex server
- 👀 **Previewing features** before setting up production
- 📚 **Learning** how the application works

**No Plex server or Trakt account required!** Everything is mocked.

---

## ⚡ Quick Start

### Test Locally (Recommended)

**Windows:**
```bash
test-demo-locally.bat
```

**Mac/Linux:**
```bash
chmod +x test-demo-locally.sh
./test-demo-locally.sh
```

Open **http://localhost:8000** and login with:
- Username: `admin`
- Password: `demo`

See: **[QUICK_START.md](QUICK_START.md)** for more options.

---

## 📋 Complete Documentation

| File | Description |
|------|-------------|
| **[QUICK_START.md](QUICK_START.md)** | ⚡ Start here - Quick overview and commands |
| **[LOCAL_TESTING.md](LOCAL_TESTING.md)** | 🧪 Test locally with Docker before deployment |
| **[RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)** | ☁️ Deploy to Railway hosting platform |
| **[DEMO_SETUP_SUMMARY.md](DEMO_SETUP_SUMMARY.md)** | 🔧 Technical implementation details |

---

## 🎬 Demo Features

### What's Included
- ✅ **13+ Sample Collections** (Movies & TV Shows)
- ✅ **30+ Movies & Shows** with realistic metadata
- ✅ **15 Pre-seeded Rotations** spanning 30 days
- ✅ **7 Collection Groups** with various configurations
- ✅ **Full Authentication** system (login/logout)
- ✅ **Demo Mode Banner** so users know it's a demo

### What Works
- ✅ Manual rotation triggering
- ✅ Rotation simulation (dry-run)
- ✅ Viewing rotation history
- ✅ Browsing collections and items
- ✅ Health status monitoring
- ✅ Configuration viewing
- ✅ Scheduler status display

### What's Mocked
- 🎭 Plex Media Server API
- 🎭 Trakt.tv API
- 🎭 Collection visibility updates
- 🎭 Media library searches

---

## 🆚 Demo vs Production

| Feature | Demo Branch | Production Branch |
|---------|-------------|-------------------|
| Plex Connection | Mock (no server needed) | Real Plex server required |
| Trakt Integration | Mock lists | Real Trakt API |
| Database | Pre-seeded with sample data | Empty initially |
| Authentication | Simple (demo/demo) | User-configured password |
| Collections | 13 sample collections | Your real Plex collections |
| Rotations | Mock updates (logged only) | Real visibility changes |
| Demo Banner | ✅ Visible | ❌ Not present |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (React + Vite)                │
│  - Demo banner displayed                │
│  - Full UI functionality                │
└─────────────────────────────────────────┘
              ↓ API Calls
┌─────────────────────────────────────────┐
│  Backend (FastAPI)                      │
│  ├─ Mock Plex Client                    │
│  │  └─ 13+ collections, 30+ items      │
│  ├─ Mock Trakt Client                   │
│  │  └─ Sample lists and trending       │
│  ├─ SQLite Database                     │
│  │  └─ Pre-seeded with 15 rotations    │
│  └─ Rotation Scheduler                  │
│     └─ Runs every 6 hours               │
└─────────────────────────────────────────┘
```

---

## 📦 Sample Data

### Collections (Movies)
- Oscar Winners 2024
- 80s Action Classics
- Criterion Collection
- Studio Ghibli Films
- Nolan Collection
- 90s Crime Dramas
- Best Picture Winners
- Sci-Fi Essentials

### Collections (TV Shows)
- HBO Prestige Dramas
- 90s Sitcoms
- Modern Comedy Classics
- British Comedy
- Anime Classics

### Collection Groups
- Award Winners (min: 1, max: 2)
- Action & Adventure (min: 0, max: 1)
- Animation (min: 0, max: 1)
- Prestige TV (min: 1, max: 1)
- Comedy (min: 0, max: 1)
- Anime (min: 0, max: 1)
- Genre Picks (min: 0, max: 1)

---

## 🚀 Deployment Options

### 1. Railway (Recommended)
Railway provides:
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ Easy GitHub integration
- ✅ Persistent volumes
- ✅ Simple environment variable management

See: **[RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)**

### 2. Docker Locally
Perfect for testing before deployment:
- ✅ Runs on any OS with Docker
- ✅ Identical to production environment
- ✅ Fast iteration during development

See: **[LOCAL_TESTING.md](LOCAL_TESTING.md)**

### 3. Other Platforms
The Docker setup works on:
- Render.com
- Fly.io
- DigitalOcean App Platform
- Any Docker-compatible host

Use `Dockerfile` and environment variables from `.env.railway`

---

## 🔧 Configuration

### Environment Variables

**Required:**
```bash
HSH_AUTH_PASSWORD=demo
HSH_AUTH_SECRET_KEY=your-secret-key-here
HSH_PLEX_TOKEN=mock-token
HSH_TRAKT_CLIENT_ID=mock-client-id
```

**Database & Logging:**
```bash
HOMESCREEN_HERO_DB=sqlite:////data/homescreen_hero.sqlite
HOMESCREEN_HERO_LOG_DIR=/data/logs
HOMESCREEN_HERO_CONFIG=/data/config.yaml
```

### Configuration File

The demo uses **`config.demo.yaml`** which includes:
- 7 collection groups with various settings
- Sample Trakt sources (mocked)
- 6-hour rotation interval
- 5 collection maximum on home screen

---

## 🛠️ Development

### Making Changes

1. **Edit mock data**: `homescreen_hero/core/integrations/mock_plex_client.py`
2. **Edit Trakt lists**: `homescreen_hero/core/integrations/mock_trakt_client.py`
3. **Edit rotation history**: `homescreen_hero/core/db/seed_demo_data.py`
4. **Edit groups**: `config.demo.yaml`
5. **Edit demo banner**: `homescreen-hero-ui/src/pages/DashboardPage.tsx`

### Testing Changes Locally

```bash
# Rebuild and test
docker build -t homescreen-hero-demo:local .
./test-demo-locally.sh
```

### Syncing with Main Branch

```bash
# Get latest changes from main
git checkout homescreen-hero-demo-setup
git merge main
# Resolve conflicts if any
git commit -m "Merge latest changes from main"
```

---

## 📊 Performance

- **Memory**: ~512MB RAM
- **Storage**: ~100MB (app + demo data)
- **Build Time**: 10-15 minutes (first time)
- **Startup Time**: 5-10 seconds
- **Database Size**: ~100KB with demo data

---

## 🐛 Troubleshooting

See the troubleshooting sections in:
- [LOCAL_TESTING.md](LOCAL_TESTING.md#troubleshooting)
- [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md#troubleshooting)

Common issues:
- **Can't login**: Default password is `demo`
- **Port in use**: Change `-p 8000:8000` to `-p 8001:8000`
- **Build fails**: Clean Docker cache with `docker system prune -a`
- **No data**: Check logs for "Seeding demo rotation history"

---

## 🔄 Converting to Production

To convert this demo to a production deployment:

1. **Switch to main branch**:
   ```bash
   git checkout main
   ```

2. **Set real credentials**:
   - Get Plex token: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
   - Get Trakt client ID: https://trakt.tv/oauth/applications

3. **Update configuration**:
   - Add your real Plex libraries
   - Add your real collections
   - Configure Trakt sources (if using)

4. **Remove demo-specific code**:
   - Demo banner in `DashboardPage.tsx`
   - Mock client imports in `plex_client.py` and `trakt_client.py`
   - Demo seeding in `app.py`

See the main branch README for production setup instructions.

---

## 📄 License

Same as main HomeScreen Hero project.

---

## 🙏 Contributing

Found a bug in the demo? Have suggestions?

1. Open an issue on GitHub
2. Describe what you were testing
3. Include browser console logs if relevant
4. Mention you're on the demo branch

---

## ⭐ About HomeScreen Hero

HomeScreen Hero is a self-hosted Plex companion that automatically rotates featured collections on your Plex home screen.

- **Main Repository**: [Link to main branch]
- **Documentation**: See main branch README
- **Demo Branch**: You are here!

---

**Ready to get started?**

👉 See **[QUICK_START.md](QUICK_START.md)** to begin!
