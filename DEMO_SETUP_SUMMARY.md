# HomeScreen Hero Demo Setup - Implementation Summary

This document summarizes all changes made to create the demo deployment branch.

## Branch: `homescreen-hero-demo-setup`

This branch contains all modifications needed to run HomeScreen Hero as a demo on Railway with mocked Plex and Trakt APIs.

---

## Changes Made

### 1. Mock Service Implementations

#### **New File**: `homescreen_hero/core/integrations/mock_plex_client.py`
- Complete mock implementation of PlexAPI
- Classes: `MockPlexServer`, `MockLibrary`, `MockCollection`, `MockMediaItem`, `MockVisibility`
- Sample data:
  - **Movies Library**: 30 movies across 8 collections (Oscar Winners, 80s Action, Criterion, Ghibli, Nolan, etc.)
  - **TV Shows Library**: 16 shows across 5 collections (HBO Dramas, Sitcoms, British Comedy, Anime)
- All Plex operations logged with `[MOCK]` prefix for clarity

#### **New File**: `homescreen_hero/core/integrations/mock_trakt_client.py`
- Complete mock implementation of Trakt API client
- Methods: `ping()`, `get_popular_movies()`, `get_trending_movies()`, `get_list_items_from_url()`
- Sample Trakt lists: Oscar Winners, Action Classics, Ghibli, Criterion
- Returns realistic Trakt API JSON structures with IMDb/TMDb IDs

### 2. Service Layer Updates

#### **Modified**: `homescreen_hero/core/integrations/plex_client.py`
```python
# Added import
from .mock_plex_client import MockPlexServer

# Modified get_plex_server() to always return mock
def get_plex_server(config: AppConfig) -> PlexServer:
    logger.info("DEMO MODE: Using mock Plex server")
    server = MockPlexServer(base_url, token)
    return server
```

#### **Modified**: `homescreen_hero/core/integrations/trakt_client.py`
```python
# Added import
from .mock_trakt_client import MockTraktClient

# Modified get_trakt_client() to always return mock
def get_trakt_client(config: AppConfig) -> Optional[TraktClient]:
    logger.info("DEMO MODE: Using mock Trakt client")
    return MockTraktClient(trakt_cfg.client_id)
```

### 3. Database Seeding

#### **New File**: `homescreen_hero/core/db/seed_demo_data.py`
- Function: `seed_demo_rotation_history(session)` - Creates 15 sample rotations
- Function: `seed_demo_collection_usage(session)` - Generates usage statistics
- Sample data spans 30 days with realistic rotation patterns
- Auto-skips if data already exists (safe for restarts)

#### **Modified**: `homescreen_hero/web/app.py`
```python
# Added imports
from homescreen_hero.core.db.history import get_db
from homescreen_hero.core.db.seed_demo_data import seed_demo_rotation_history

# Added to startup event
@app.on_event("startup")
async def _start_scheduler():
    init_db()
    # Seed demo data
    logger.info("DEMO MODE: Seeding demo rotation history")
    db = next(get_db())
    seed_demo_rotation_history(db)
    db.close()
```

### 4. Frontend Changes

#### **Modified**: `homescreen-hero-ui/src/pages/DashboardPage.tsx`
- Added prominent demo mode banner at top of dashboard
- Purple/blue gradient banner with info icon
- Text: "Demo Mode - You're viewing a demo with sample data. No real Plex server connected."
- Includes GitHub link button (update URL before production)
- Fully responsive design

### 5. Deployment Configuration

#### **New File**: `railway.json`
- Railway-specific deployment config
- Dockerfile builder configuration
- Start command with single worker (required for APScheduler)
- Restart policy: ON_FAILURE with 3 max retries

#### **New File**: `.env.railway`
- Template environment variables for Railway
- Mock Plex token and Trakt client ID
- Simple demo password (`demo`)
- Database and config paths for Railway volume mount (`/data`)

#### **New File**: `config.demo.yaml`
- Complete demo configuration with 7 collection groups
- Sample Trakt sources
- 6-hour rotation interval
- 5 collection maximum
- Mix of enabled/disabled groups for variety
- Realistic visibility settings

#### **New File**: `RAILWAY_DEPLOY.md`
- Comprehensive deployment guide
- Step-by-step Railway setup instructions
- Environment variable documentation
- Volume configuration guide
- Troubleshooting section
- Demo data overview

---

## File Structure

```
homescreen-hero/
├── homescreen_hero/
│   ├── core/
│   │   ├── integrations/
│   │   │   ├── plex_client.py          [MODIFIED]
│   │   │   ├── trakt_client.py         [MODIFIED]
│   │   │   ├── mock_plex_client.py     [NEW]
│   │   │   └── mock_trakt_client.py    [NEW]
│   │   ├── db/
│   │   │   └── seed_demo_data.py       [NEW]
│   │   └── ...
│   ├── web/
│   │   └── app.py                      [MODIFIED]
│   └── ...
├── homescreen-hero-ui/
│   └── src/
│       └── pages/
│           └── DashboardPage.tsx       [MODIFIED]
├── .env.railway                        [NEW]
├── config.demo.yaml                    [NEW]
├── railway.json                        [NEW]
├── RAILWAY_DEPLOY.md                   [NEW]
└── DEMO_SETUP_SUMMARY.md               [NEW]
```

---

## Demo Features

### What Works ✅
- Complete UI navigation and interaction
- Health checks (all mocked as "OK")
- Manual rotation triggering (updates mock state)
- Rotation simulation/dry-run
- Rotation history viewing (15 pre-seeded rotations)
- Collection browsing (13+ collections)
- Authentication (username: `admin`, password: `demo`)
- Configuration management
- Scheduler status display

### What's Mocked 🎭
- Plex server connection and library data
- Trakt API calls and list syncing
- All collection visibility updates
- Media item searches and matching

### What Doesn't Work ❌
- Real Plex server connections
- Actual media library updates
- Real Trakt list syncing
- External API calls

---

## Deployment Checklist

Before deploying to Railway:

- [ ] Verify you're on `homescreen-hero-demo-setup` branch
- [ ] All files committed and pushed
- [ ] Update GitHub URL in demo banner (`DashboardPage.tsx`)
- [ ] Set Railway environment variables from `.env.railway`
- [ ] Create `/data` volume in Railway (minimum 1GB)
- [ ] Upload `config.demo.yaml` to `/data/config.yaml` after first deploy
- [ ] Test login with `admin` / `demo`
- [ ] Verify rotation history shows sample data
- [ ] Confirm collections are visible

---

## Technical Notes

### Why Option B (Separate Branch)?
- Clean separation from production code
- No conditional logic cluttering the codebase
- Easy to maintain and deploy
- Simple to test locally
- Can merge updates from main as needed

### Mock Implementation Quality
- Mimics real PlexAPI interfaces
- Returns realistic data structures
- Proper error handling
- Comprehensive logging
- Type hints maintained

### Database Considerations
- SQLite persists across restarts with Railway volume
- Demo data seeds only once (checks for existing records)
- Safe for container restarts
- Can be cleared with `clear_demo_data()` function

### Performance
- Mock services are fast (no network calls)
- Minimal memory footprint (~512MB)
- Frontend pre-built (no dev server overhead)
- Single worker process for scheduler consistency

---

## Next Steps

1. **Test Locally**:
   ```bash
   docker build -t homescreen-hero-demo .
   docker run -p 8000:8000 \
     -e HSH_AUTH_PASSWORD=demo \
     -e HSH_PLEX_TOKEN=mock \
     -e HSH_TRAKT_CLIENT_ID=mock \
     homescreen-hero-demo
   ```

2. **Deploy to Railway**: Follow `RAILWAY_DEPLOY.md`

3. **Share Demo**: Provide URL to users for testing

4. **Gather Feedback**: Monitor usage and collect user feedback

5. **Iterate**: Make improvements based on feedback

---

## Maintenance

### Updating Mock Data
- Edit `mock_plex_client.py` to add/remove collections
- Modify `seed_demo_data.py` to change rotation patterns
- Update `config.demo.yaml` for different group configurations

### Syncing with Main Branch
```bash
git checkout homescreen-hero-demo-setup
git merge main
# Resolve any conflicts in integration files
git commit -m "Merge updates from main"
```

### Converting to Production
See "Converting Demo to Production" section in `RAILWAY_DEPLOY.md`

---

## Credits

Demo implementation designed for Railway deployment with complete mock API layer.

All sample movie/show data is for demonstration purposes only.

---

**Demo Branch Status**: ✅ Ready for Railway Deployment
