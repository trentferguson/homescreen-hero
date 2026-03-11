# homescreen-hero

A self-hosted Plex companion app that automatically rotates collections on the homescreen via a FastAPI + React dashboard.

## Tech Stack

**Backend:** Python 3.9+, FastAPI, SQLite, Pydantic
**Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Recharts
**Testing:** pytest (backend), Vitest (frontend)
**Deployment:** Docker, Docker Compose

## Project Structure

```
homescreen-hero/
├── homescreen_hero/           # Python backend (FastAPI)
│   ├── core/                  # Business logic
│   │   ├── config/            # YAML config loading & schema
│   │   ├── db/                # SQLite models & database operations
│   │   ├── integrations/      # External API clients (Plex, Trakt, MDBList, Tautulli, Letterboxd)
│   │   ├── auth.py            # Authentication
│   │   ├── rotation.py        # Collection rotation logic
│   │   ├── scheduler.py       # Background task scheduling
│   │   └── service.py         # Core service orchestration
│   ├── web/                   # FastAPI web layer
│   │   ├── routers/           # API route handlers
│   │   └── app.py             # FastAPI app entry point
│   ├── requirements.txt       # Production dependencies
│   └── requirements-dev.txt   # Test dependencies
├── homescreen-hero-ui/        # React frontend
│   └── src/                   # React components, hooks, pages
├── data/                      # Runtime data (config.yaml, SQLite DB, logs)
└── docker-compose.yml
```

## Common Commands

### Backend
```bash
# Activate venv (from homescreen_hero directory)
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Run backend dev server
uvicorn homescreen_hero.web.app:app --reload --port 8000

# Run tests
pytest

# Run tests with coverage
pytest --cov=homescreen_hero --cov-report=html
```

### Frontend
```bash
cd homescreen-hero-ui

# Install dependencies
npm install

# Run dev server (port 5173)
npm run dev

# Run tests
npm test           # Watch mode
npm run test:run   # Single run
npm run test:ui    # With UI

# Build
npm run build

# Lint
npm run lint
```

### Docker
```bash
# Start app
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild
docker-compose up -d --build
```

## Git Workflow

- Main branch: `develop`
- Feature branches: `feature-*`
- Bugfix branches: `fix-*`
- PRs target `develop`
- Releases are tagged from `develop` (e.g., `v0.4.0`)
- Nightly Docker builds from `develop`

## Code Style

### Python
- Type hints preferred
- Pydantic models for request/response schemas
- Config schema defined in `homescreen_hero/core/config/schema.py`
- Logging via `homescreen_hero/core/logging_config.py`

### TypeScript/React
- Functional components with hooks
- Tailwind CSS for styling
- Headless UI for accessible components
- Lucide React for icons

### Comments

**Prefer `#` hash comments over docstrings.** Keep code readable through good naming and inline `#` comments where needed.

Docstrings (`"""..."""`) are acceptable for:
- Public API endpoints that external users consume
- Complex utility functions that are reused across the codebase
- Functions where IDE hover tooltips would genuinely help

Avoid:
- Docstrings on every function just for the sake of documentation
- Comments that describe *what* code does (the code should be self-explanatory)
- Redundant comments that repeat the function/variable name

Good:
```python
# Retry up to 3 times because Plex API occasionally drops connections
for attempt in range(3):
    ...
```

Bad:
```python
def get_collections():
    """Gets the collections."""  # Redundant, adds no value
    ...
```

## Key Integrations

| Integration | Client File | Purpose |
|-------------|-------------|---------|
| Plex | `core/integrations/plex_client.py` | Core functionality - library & collection management |
| Trakt | `core/integrations/trakt_client.py` | Third-party list sync |
| MDBList | `core/integrations/mdblist_client.py` | Third-party list sync |
| Tautulli | `core/integrations/tautulli_client.py` | Analytics & streaming metrics |
| TMDb | `core/integrations/tmdb_client.py` | Third-party list sync |
| Letterboxd | `core/integrations/letterboxd_scraper.py` | List scraping |
| AniList | `core/integrations/anilist_client.py` | Anime list sync |

## API Documentation

When backend is running: `http://localhost:8000/docs` (Swagger UI)

## Environment Variables

Sensitive values go in `.env` (not committed):
- `HSH_PLEX_TOKEN` - Plex auth token
- `HSH_PLEX_URL` - Plex server URL
- `HSH_AUTH_PASSWORD` - Admin password
- `HSH_AUTH_SECRET_KEY` - JWT secret
- `HSH_TRAKT_CLIENT_ID` - Trakt API client ID
- `HSH_MDBLIST_API_KEY` - MDBList API key
- `HSH_TMDB_API_KEY` - TMDb API key
- `HSH_TAUTULLI_API_KEY` - Tautulli API key
- `HSH_TAUTULLI_BASE_URL` - Tautulli server URL

## Testing Notes

- Backend tests: `homescreen_hero/tests/`
- Frontend tests: `homescreen-hero-ui/src/**/*.test.{ts,tsx}`
- See `TESTING.md` for detailed testing documentation
