# Contributing to homescreen-hero

Thanks for your interest in contributing! This guide covers how to set up a local development environment.

## Prerequisites

- **Frontend:** Node.js (v18+) and npm
- **Backend:** Python (v3.9+) and pip
- Docker and Docker Compose (optional)

## Project Structure

```
homescreen-hero/
├── homescreen-hero-ui/     # React frontend (TypeScript, Vite, Tailwind)
│   ├── src/                # Components, hooks, pages
│   ├── package.json
│   └── vite.config.ts
├── homescreen_hero/        # Python backend (FastAPI)
│   ├── core/               # Business logic, config, integrations
│   ├── web/                # API routers and app entry point
│   ├── tests/              # Backend tests
│   └── requirements.txt
├── data/                   # Runtime data (config, DB, logs)
├── docker-compose.yml
└── example.config.yaml
```

## Local Development Setup

### 1. Clone and Configure

```bash
git clone https://github.com/trentferguson/homescreen-hero.git
cd homescreen-hero

# Copy example config to root folder for local dev
cp example.config.yaml config.yaml
# Edit config.yaml with your Plex details
```

### 2. Backend Setup

```bash
cd homescreen_hero

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run dev server
uvicorn homescreen_hero.web.app:app --reload --port 8000
```

The API will be at `http://localhost:8000` with docs at `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
cd homescreen-hero-ui

# Install dependencies
npm install

# Run dev server
npm run dev
```

The frontend will be at `http://localhost:5173`.

## Running Tests

**Backend:**
```bash
cd homescreen_hero
pytest
pytest --cov=homescreen_hero --cov-report=html  # With coverage
```

**Frontend:**
```bash
cd homescreen-hero-ui
npm test              # Watch mode
npm run test:run      # Single run
npm run test:ui       # With UI
```

## Code Style

### Python
- Type hints preferred
- Pydantic models for request/response schemas
- Use `#` comments over docstrings (see [CLAUDE.md](.claude/CLAUDE.md) for details)

### TypeScript/React
- Functional components with hooks
- Tailwind CSS for styling
- Headless UI for accessible components
- Lucide React for icons

## Git Workflow

- Main branch: `develop`
- Feature branches: `feature-*`
- Bugfix branches: `fix-*`
- PRs target `develop`

## Docker Development

```bash
# Build and run
docker-compose up -d --build

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose up -d --build
```

## Questions?

Open an issue or join the [Discord](https://discord.gg/yQ8pJzURsr)!
