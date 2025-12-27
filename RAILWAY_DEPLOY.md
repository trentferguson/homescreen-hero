# Deploying HomeScreen Hero Demo to Railway

This guide will help you deploy the HomeScreen Hero demo on Railway with mocked Plex and Trakt data.

## Prerequisites

- A [Railway](https://railway.app) account (free tier works fine)
- Git repository connected to Railway

## Quick Deploy

### Option 1: Deploy via Railway Dashboard

1. **Fork or clone this repository** (make sure you're on the `homescreen-hero-demo-setup` branch)

2. **Create a new project in Railway**
   - Go to [railway.app/new](https://railway.app/new)
   - Choose "Deploy from GitHub repo"
   - Select your fork of this repository
   - Select the `homescreen-hero-demo-setup` branch

3. **Configure Environment Variables**

   In your Railway service settings, add these environment variables:

   ```bash
   # Authentication
   HSH_AUTH_PASSWORD=demo
   HSH_AUTH_SECRET_KEY=railway-demo-secret-key-change-me

   # Mock API credentials (required but not used)
   HSH_PLEX_TOKEN=demo-mock-token
   HSH_TRAKT_CLIENT_ID=demo-mock-client-id

   # Database & Config paths
   HOMESCREEN_HERO_DB=sqlite:////data/homescreen_hero.sqlite
   HOMESCREEN_HERO_LOG_DIR=/data/logs
   HOMESCREEN_HERO_CONFIG=/data/config.yaml
   ```

4. **Add a Persistent Volume**
   - In Railway service settings, go to "Volumes"
   - Click "New Volume"
   - Mount path: `/data`
   - This will persist your SQLite database and logs

5. **Upload Demo Configuration**
   - After the first deployment, use Railway's file browser or CLI to upload `config.demo.yaml` to `/data/config.yaml`
   - Or set `HOMESCREEN_HERO_CONFIG` to point to a config file in your repo

6. **Deploy**
   - Railway will automatically build and deploy using the Dockerfile
   - Build takes ~5-10 minutes (includes frontend build)

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to project (or create new)
railway link

# Set environment variables
railway variables set HSH_AUTH_PASSWORD=demo
railway variables set HSH_AUTH_SECRET_KEY=railway-demo-secret-key-change-me
railway variables set HSH_PLEX_TOKEN=demo-mock-token
railway variables set HSH_TRAKT_CLIENT_ID=demo-mock-client-id
railway variables set HOMESCREEN_HERO_DB=sqlite:////data/homescreen_hero.sqlite
railway variables set HOMESCREEN_HERO_LOG_DIR=/data/logs

# Add volume for data persistence
railway volume add -m /data

# Deploy
railway up
```

## Accessing the Demo

Once deployed:

1. **Get your URL**: Railway will provide a public URL like `https://your-service.railway.app`

2. **Login Credentials**:
   - Username: `admin`
   - Password: `demo` (or whatever you set in `HSH_AUTH_PASSWORD`)

3. **Explore the Demo**:
   - View sample rotation history
   - Trigger manual rotations (mock Plex updates)
   - Simulate rotations
   - Explore collection groups and settings
   - Check health status (all mocked)

## What's Mocked?

The demo branch includes mock implementations of:

- **Plex Server**: Returns sample movies and TV shows with realistic collections
- **Trakt API**: Returns sample lists and trending content
- **Database**: Pre-seeded with 15 rotations over the past 30 days
- **Collections**: 13+ sample collections across Movies, TV Shows, and Anime

## Demo Data

### Sample Collections (Movies)
- Oscar Winners 2024
- 80s Action Classics
- Criterion Collection
- Studio Ghibli Films
- Nolan Collection
- 90s Crime Dramas
- Best Picture Winners
- Sci-Fi Essentials

### Sample Collections (TV Shows)
- HBO Prestige Dramas
- 90s Sitcoms
- Modern Comedy Classics
- British Comedy
- Anime Classics

### Features You Can Test
- ✅ Manual rotation triggering
- ✅ Rotation simulation (dry-run)
- ✅ Rotation history viewing
- ✅ Collection group management
- ✅ Health check monitoring
- ✅ Authentication system
- ✅ Configuration management
- ✅ Scheduler status

### What Doesn't Work
- ❌ Real Plex server connections
- ❌ Real Trakt list syncing
- ❌ Actual media library updates

## Configuration

The demo uses `config.demo.yaml` which includes:

- 7 collection groups
- Mix of enabled/disabled groups
- Various min/max pick settings
- Different visibility configurations
- 6-hour rotation interval
- 5 collection maximum on home screen

## Troubleshooting

### Build Fails
- Check that you're on the `homescreen-hero-demo-setup` branch
- Verify Dockerfile exists in the repository root
- Check Railway build logs for specific errors

### App Won't Start
- Ensure all required environment variables are set
- Check that the volume is mounted at `/data`
- Review application logs in Railway dashboard

### Can't Login
- Default credentials are `admin` / `demo`
- Check that `HSH_AUTH_PASSWORD` is set correctly
- Try clearing browser cookies/cache

### Database Issues
- Ensure `/data` volume is properly mounted
- Check that `HOMESCREEN_HERO_DB` points to `/data/homescreen_hero.sqlite`
- The database auto-initializes on first run

## Customization

### Change Demo Data
Edit these files to customize the demo:
- `homescreen_hero/core/integrations/mock_plex_client.py` - Modify sample movies/collections
- `homescreen_hero/core/integrations/mock_trakt_client.py` - Modify Trakt lists
- `homescreen_hero/core/db/seed_demo_data.py` - Change rotation history patterns
- `config.demo.yaml` - Adjust collection groups and settings

### Update Demo Banner
Edit `homescreen-hero-ui/src/pages/DashboardPage.tsx` to change the demo mode banner text or styling.

## Railway-Specific Notes

- **Build Time**: First build takes ~5-10 minutes (includes frontend compilation)
- **Memory**: ~512MB RAM should be sufficient for the demo
- **Storage**: Volume should be at least 1GB for database and logs
- **Port**: Railway automatically assigns a port via `$PORT` environment variable
- **Restart Policy**: Configured to restart on failure with max 3 retries

## Support

For issues specific to this demo deployment:
- Check the [main README](README.md) for general HomeScreen Hero documentation
- Review Railway's [documentation](https://docs.railway.app)
- Open an issue on GitHub if you encounter problems

## Converting Demo to Production

To convert this demo to a production deployment:
1. Checkout the `main` branch
2. Remove mock client imports from `plex_client.py` and `trakt_client.py`
3. Remove demo data seeding from `app.py`
4. Set real Plex token and Trakt client ID
5. Update configuration with your real libraries and collections
6. Remove demo banner from frontend

Happy demoing! 🎬
