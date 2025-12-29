

<div align="center">
<img width="35%" height="35%" alt="homescreen-hero_logo_cropped_wide_again" src="https://github.com/user-attachments/assets/892ea966-cf31-4a2e-8494-c92afe08ad49" />

[![Typing SVG](https://readme-typing-svg.herokuapp.com?font=Oxanium&size=36&pause=1000&color=F3B358&background=FFFFFF00&center=true&repeat=false&width=435&lines=homescreen-hero)](https://git.io/typing-svg)

**A self-hosted web app that keeps your Plex home screen fresh by automatically rotating collections (scheduled or manual) via a modern FastAPI + React dashboard.**

![Static Badge](https://img.shields.io/badge/Plex-%20Built%20for%20Plex-e5a00d?style=flat&logo=Plex)
<img alt="Static Badge" src="https://img.shields.io/badge/Discord-Get%20Suppor!!-5865F2?style=flat&logo=Discord&link=https%3A%2F%2Fdiscord.gg%2FmNFGaQ6N6c">
 ![Static Badge](https://img.shields.io/badge/Claude-vibecoded(ish)-%23D97757?style=flat&logo=Claude) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![GitHub Release](https://img.shields.io/github/v/release/trentferguson/homescreen-hero?logo=GitHub&color=%2327B63F)


## Try the Demo

**[Check out the live demo](https://demo.homescreenhero.com)** to see HomeScreen Hero in action!

</div>

## A Quick Heads Up

This app is very much a **WORK IN PROGRESS**. This started as a simple Python script to rotate my Plex homescreen, and slowly turned in to much, much more. I still have a lot of really cool things planned in the coming weeks, so stay tuned!

**Important Note:** a good portion of this app is vibe-coded
(especially the frontend). As a Data Engineer who originally went to school to become a full-stack developer, a big part of creating this app for myself was to get a true understanding of where AI Coding Agents stand today, and what exactly they can/cannot do. I got tired of the headlines/Reddit comments and figured this was the quickest way to the truth.
## Overview

**HomeScreen Hero** aims to be your one-stop-shop for managing your Plex homescreen. Right now, HomeScreen Hero is a self-hosted Plex companion app that I built to solve a simple problem: keeping my Plex home screen from getting stale. It automatically rotates collections on a schedule, so featured content stays fresh without constantly tweaking things by hand. There’s a clean React-based web UI (Thanks Stitch/Claude!) for configuring and monitoring everything, with a FastAPI backend doing the heavy lifting behind the scenes.

## Features

-   **First-Time Setup Wizard:** Guided step-by-step configuration for new installations - get started in minutes without touching config files!
-   **Automated Plex Collection Rotation:** Schedule collections to rotate on your Plex home screen at predefined intervals. Various config options to get things exactly the way you want them!
-   **Intuitive Web Dashboard:** A modern React-based UI for easy configuration and monitoring of your Plex homescreen.
-   **Manage all your Collections in One Place:** Whether it be your already existing Plex collections, or collections created from 3rd Party lists, you can create, edit, and delete them all inside the homescreen-hero UI!
-   **Built Specifically for Plex:** Seamlessly connects with your Plex server to fetch libraries and manage collections. Pulls data directly from your Plex server for use (creating collection groups, displaying posters, etc.)
-   ** 3rd Party Integrations:** Easily connect to third party applications to automatically create and feature collections based off Trakt lists (IMDb, TMDb, TVDb, and more coming soon!)
-   **Flexible Configuration:** Utilize either the Web UI, the Setup Wizard, or the YAML-based configuration file for detailed control over application settings and Plex interactions
-   **Containerized Deployment:** Easily deploy and manage the entire application using Docker and Docker Compose.

## Screenshots (or checkout the demo link above)

### Dashboard/System Overview:
<img width="1910" height="1214" alt="image" src="https://github.com/user-attachments/assets/81eaff32-f4bc-4d9a-8935-85935f49b528" />

### Groups Page:
<img width="1823" height="1123" alt="image" src="https://github.com/user-attachments/assets/04c69449-9849-4871-8924-e645371fa403" />

### Manage Groups (edit details, change schedule, add/remove collections)
<img width="1757" height="1214" alt="image" src="https://github.com/user-attachments/assets/a9041a47-f41b-47df-915d-bdf542767a8d" />
<img width="1723" height="1124" alt="image" src="https://github.com/user-attachments/assets/551083ab-9ebd-4d6e-a38e-0165344667c6" />

### Collections Page (Create, Edit, and Delete your Plex/Trakt collections):
<img width="1711" height="1209" alt="image" src="https://github.com/user-attachments/assets/76f7e00c-1212-48f0-999a-1bcfee785d6f" />


## Tech Stack

**Frontend:**

![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**Backend:**

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white) ![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

**DevOps:**

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white) ![Docker Compose](https://img.shields.io/badge/Docker%20Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## Quick Start

This project is designed for easy deployment using Docker and Docker Compose.

### Prerequisites

-   [Docker Engine](https://docs.docker.com/engine/install/) (latest stable version)
-   [Docker Compose](https://docs.docker.com/compose/install/) (v2.x recommended)
-   A running [Plex Media Server](https://www.plex.tv/media-server-downloads/)
-   A Plex authentication token ([how to find it](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/))
-   (Optional) A Trakt API Key for third-party list integration ([how to get it](https://trakt.tv/oauth/applications))

### Installation

HomeScreen Hero offers **two setup methods** - choose the one that works best for you:

#### Option 1: Setup Wizard (Recommended for New Users)

The easiest way to get started! The setup wizard guides you through configuration step-by-step.

1.  **Clone the repository**
    ```bash
    git clone https://github.com/trentferguson/homescreen-hero.git
    cd homescreen-hero
    ```

2.  **Create data directory**
    ```bash
    mkdir -p data
    ```

3.  **Start the application**
    ```bash
    docker-compose up -d
    ```

4.  **Open your browser and complete setup**
    - Visit `http://localhost:8000`
    - The **Setup Wizard** will automatically launch on first run
    - Follow the guided steps to configure:
      - Plex server connection
      - Library selection
      - Authentication (optional but recommended)
      - Trakt integration (optional)
      - Automatic rotation settings

That's it! The wizard will create your `config.yaml` automatically.

#### Option 2: Manual Configuration (Advanced Users)

For users who prefer direct control or want to use environment variables for secrets.

1.  **Clone the repository**
    ```bash
    git clone https://github.com/trentferguson/homescreen-hero.git
    cd homescreen-hero
    ```

2.  **Set up environment variables (recommended for security):**
    ```bash
    cp .env.example .env
    ```
    Edit `.env` and fill in your sensitive values:
    - `HSH_PLEX_TOKEN`: Your Plex authentication token
    - `HSH_PLEX_URL`: Your Plex server URL (e.g., `http://192.168.1.100:32400`)
    - `HSH_AUTH_PASSWORD`: Your desired admin password (if enabling auth)
    - `HSH_AUTH_SECRET_KEY`: Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
    - `HSH_TRAKT_CLIENT_ID`: Your Trakt API client ID (if using Trakt)

3.  **Create configuration file**
    ```bash
    mkdir -p data
    cp example.config.yaml data/config.yaml
    ```
    Edit `data/config.yaml` to configure:
    - `plex.libraries`: List of libraries to manage (e.g., Movies, TV Shows)
    - `rotation` settings: interval, max collections, strategy
    - `groups`: Define your collection groups
    - `groups`: Define your collection groups

    **Note:** Sensitive values (tokens, passwords) should be in `.env`, not in `config.yaml`
    **Note:** Sensitive values (tokens, passwords) should be in `.env`, not in `config.yaml`

4.  **Start the application**
    ```bash
    docker-compose up -d
    ```

5.  **Access the dashboard**
    Visit `http://localhost:8000` to access the web UI

## Project Structure

```
homescreen-hero/
├── .dockerignore           # Files to ignore when building Docker images
├── .gitignore              # Files to ignore in Git
├── Dockerfile              # Dockerfile for building the application image
├── LICENSE                 # Project license (MIT)
├── docker-compose.yml      # Docker Compose configuration for multi-service setup
├── example.config.yaml     # Example configuration file for HomeScreen Hero
├── homescreen-hero-ui/     # Frontend React application source code
│   ├── public/             # Static assets for the frontend
│   ├── src/                # Frontend source code (React components, hooks, etc.)
│   ├── package.json        # Frontend dependencies and scripts
│   ├── tsconfig.json       # TypeScript configuration for frontend
│   └── vite.config.ts      # Vite configuration for frontend build
└── homescreen_hero/        # Backend FastAPI application source code
    ├── app/                # Main application logic, routers, models
    ├── core/               # Core utilities, configuration, dependencies
    ├── api/                # API route definitions
    ├── schemas/            # Pydantic models for request/response validation
    ├── crud/               # Database interaction logic (if ORM used)
    ├── main.py             # FastAPI application entry point
    ├── requirements.txt    # Python dependencies for the backend
    └── tests/              # Backend test files
```

## Configuration

### Security Best Practices

For enhanced security, sensitive values (tokens, passwords, API keys) can be stored in environment variables instead of directly in `config.yaml`. This is especially important when:
- Committing your config to version control
- Running in production environments
- Sharing your config with others

**Supported Environment Variables:**
- `HSH_PLEX_TOKEN` - Your Plex authentication token
- `HSH_AUTH_PASSWORD` - Authentication password (when auth is enabled)
- `HSH_AUTH_SECRET_KEY` - JWT secret key (when auth is enabled)
- `HSH_TRAKT_CLIENT_ID` - Trakt API client ID (when Trakt is enabled)

**Setup:**
1. Copy [.env.example](.env.example) to `.env`
2. Fill in your sensitive values in the `.env` file
3. Remove or leave empty the corresponding fields in `config.yaml`
4. The application will automatically use environment variables as fallback

**Example `.env` file:**
```bash
HSH_PLEX_TOKEN=your-plex-token-here
HSH_AUTH_PASSWORD=your-secure-password
HSH_AUTH_SECRET_KEY=your-secret-key-here
```

Environment variables take precedence over values in `config.yaml`.

### Configuration File

Settings live in `config.yaml` and follow the schema in `homescreen_hero/core/config/schema.py`. Here is the provided starter layout:
```yaml
plex:
  base_url: "YOUR_PLEX_SERVER_URL"
  token: "YOUR_PLEX_TOKEN"
  libraries: # List of Plex libraries to use
  token: "YOUR_PLEX_TOKEN"
  libraries: # List of Plex libraries to use
    - name: Movies
      enabled: true
rotation:
  enabled: true
  interval_hours: 12
  max_collections: 5
  strategy: random
  allow_repeats: false
trakt:
  enabled: false
  client_id: "YOUR_TRAKT_CLIENT_ID"
  client_id: "YOUR_TRAKT_CLIENT_ID"
  base_url: https://api.trakt.tv
  sources:
  - name: "TRAKT_COLLECTION_NAME" # This is the name that will show up in Plex
    url: "LINK_TO_TRAKT_COLLECTION_OR_LIST" # e.g., https://trakt.tv/users/username/collections/movies
    plex_library: "YOUR_PLEX_LIBRARY_NAME"
  - name: "TRAKT_COLLECTION_NAME" # This is the name that will show up in Plex
    url: "LINK_TO_TRAKT_COLLECTION_OR_LIST" # e.g., https://trakt.tv/users/username/collections/movies
    plex_library: "YOUR_PLEX_LIBRARY_NAME"
logging:
  level: INFO
groups:
- name: ExampleGroup
  enabled: true
  min_picks: 1
  max_picks: 1
  weight: 1
  min_gap_rotations: 0
  collections:
  - Example Collection 1
  - Example Collection 2
  - Testing Testing
```

Key sections:
- **plex** – Server URL, token, and library name to target.
- **plex** – Server URL, token, and library name to target.
- **rotation** – Enable/disable scheduling, interval hours, max collections, strategy, and repeat rules.
- **groups** – Named pools of collections with min/max picks, weights, gaps between uses, and optional date windows.
- **trakt** – Enable Trakt, set the client ID, base URL, and list sources to sync into Plex collections.
- **groups** – Named pools of collections with min/max picks, weights, gaps between uses, and optional date windows.
- **trakt** – Enable Trakt, set the client ID, base URL, and list sources to sync into Plex collections.
- **logging** – Log level for both CLI and API processes.

## Docker

A ready-to-use Compose file builds the service, exposes the API on **port 8000**, and mounts `./data` for config, database, and logs:

```bash
docker-compose up -d
```

### Environment Variables in Docker

The `docker-compose.yml` is configured to read sensitive values from a `.env` file:

1. **Copy the example:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your values:**
   ```bash
   HSH_PLEX_TOKEN=your-actual-plex-token
   HSH_AUTH_PASSWORD=your-secure-password
   HSH_AUTH_SECRET_KEY=your-generated-secret-key
   ```

3. **Start the container:**
   ```bash
   docker-compose up -d
   ```

Docker Compose automatically loads variables from `.env` and passes them to the container. The syntax `${HSH_PLEX_TOKEN}` references the variable from your `.env` file, and `${HSH_AUTH_PASSWORD:-}` uses the value if set or an empty string if not.

**Additional environment variables:**
- `HOMESCREEN_HERO_CONFIG` - Path to config file (default: `/data/config.yaml`)
- `HOMESCREEN_HERO_DB` - Database path (default: `sqlite:////data/homescreen_hero.sqlite`)
- `HOMESCREEN_HERO_LOG_DIR` - Log directory (default: `/data/logs`)

Health checks ping `/api/health` to confirm the API is ready.

## Development

For local development, you will typically run the frontend and backend services separately.

### Prerequisites for Development

-   **Frontend:** Node.js (v18+) and npm/yarn/pnpm
-   **Backend:** Python (v3.9+) and pip
-   Docker and Docker Compose (optional, but useful for database or other services)
-   Use provided example.config.yaml or example from above and **create config.yaml in your root folder** (homescreen-hero)

### Frontend Development (`homescreen-hero-ui`)

1.  Navigate to the frontend directory:
    ```bash
    cd homescreen-hero-ui
    ```
2.  Install dependencies:
    ```bash
    npm install # or yarn install / pnpm install
    ```
3.  Start the development server:
    ```bash
    npm run dev # or yarn dev / pnpm dev
    ```
    The frontend will typically run on `http://localhost:5173` (Vite default).

### Backend Development (`homescreen_hero`)

1.  Navigate to the backend directory:
    ```bash
    cd homescreen_hero
    ```
2.  Create and activate a Python virtual environment:
    ```bash
    python -m venv .venv
    source .venv/bin/activate # On Windows: .venv\Scripts\activate
    ```
3.  Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Start the FastAPI development server:
    ```bash
    uvicorn homescreen_hero.web.app:app --reload --port 8000
    ```
    The backend API will be available at `http://localhost:8000`. Access the auto-generated API documentation at `http://localhost:8000/docs` or `http://localhost:8000/redoc`.

## API Reference

The FastAPI backend automatically generates interactive API documentation.
Once the backend is running (either via `docker-compose` or locally), you can access:

-   **Swagger UI:** `http://localhost:[BACKEND_PORT]/docs`
-   **ReDoc:** `http://localhost:[BACKEND_PORT]/redoc`

These interfaces provide detailed information about all available endpoints, their expected request bodies, and response schemas.

### Key Endpoints (Expected)

-   `/api/plex/status`: Check Plex connection status.
-   `/api/plex/collections`: List/manage Plex collections.
-   `/api/rotation/schedule`: Configure collection rotation schedules.
-   `/api/rotation/trigger`: Manually trigger a collection rotation.
-   `/api/config`: Manage application configuration.

## Contributing

Any and all contributions to HomeScreen Hero are welcome! If you're interested in improving the project, please refer to our contribution guidelines (once available).

### Development Setup for Contributors

Follow the **Development** section above to set up your local environment for both frontend and backend development.

## License

This project is licensed under the [MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

-   **Agregarr:** For being an amazing self-hosted app and inspiring me to try building something myself. Seriously, this app is awesome.
-   **ColleXions:** For initially doing exactly what I needed this app today. Another great inspiration for me to try my own hand at an creating something like this.
-   **Stitch (Google):** For helping me come up with a clean frontend design philosophy. It took a lot of trial error (I have almost no frontend dev experience, but turns out I'm very picky about what it looks like lol)
-   **Claude Code, Chat GPT, and Github Copilot:** For building ~90% of my frontend. As a Data Engineer, a big part of creating this app for myself was to get a true understanding of where AI Coding Agents stand today, and what exactly they can/cannot do. I got tired of the headlines/Reddit comments and figured this was the quickest way to the truth.

## 🐶 Puppy Tax 
I'm not ashamed to use my cutie for free internet points! (she was also great moral support on the *"I've been banging my head against a wall for days trying to figure out why the rotation runs every thirty seconds lol*)

<img width="25%" height="25%" alt="IMG_3015" src="https://github.com/user-attachments/assets/e24b34da-b541-4ead-b822-98ec31b5154e" />
<img width="25%" height="25%" alt="IMG_1225" src="https://github.com/user-attachments/assets/a4b6ad17-063b-4068-ac2d-91ec60f117f2" />
<img width="25%" height="25%" alt="IMG_3017" src="https://github.com/user-attachments/assets/300e1e92-ea19-4dc0-8dfc-8a17413725c6" />

---

<div align="center">

**⭐ Star this repo if you find it helpful!**

Made with ❤️, 💧, and ☕ by [trentferguson](https://github.com/trentferguson)

</div>
