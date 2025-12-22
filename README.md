

<div align="center">
<img width="400" height="270" alt="homescreen-hero_logo_text" src="https://github.com/user-attachments/assets/1904eb65-4d8c-4b85-8fd9-c3983e0488af" />


**A self-hosted web app that keeps your Plex home screen fresh by automatically rotating collections (scheduled or manual) via a modern FastAPI + React dashboard.**

<!-- TODO: Add live demo link maybe? -->

</div>

## 🚫A Quick Heads Up

This app is very much a **WIP**. This started as a simple Python script to rotate my Plex homescreen, and slowly turned in to much, much more. I still have a lot of really cool things planned in the coming weeks, so stay tuned!

**Please note**- a good portion of this app is vibe-coded
(especially the frontend). As a Data Engineer who originally went to school to become a full-stack developer, a big part of creating this app for myself was to get a true understanding of where AI Coding Agents stand today, and what exactly they can/cannot do. I got tired of the headlines/Reddit comments and figured this was the quickest way to the truth.
## Overview

HomeScreen Hero provides a powerful, self-hosted solution for Plex Media Server users to dynamically manage their home screen content. It empowers you to automate the rotation of Plex collections, ensuring your content recommendations stay fresh and engaging without manual intervention. The application features a sleek web dashboard built with React (thanks Chat GPT!), facilitating easy configuration and control over your collection rotation schedules, all backed by a robust FastAPI backend.

## Features

-   **Automated Plex Collection Rotation:** Schedule collections to rotate on your Plex home screen at predefined intervals.
-   **Manual Collection Rotation:** Trigger instant rotation of collections directly from the web dashboard. You can even simulate fake rotations and apply them if you like them!
-   **Intuitive Web Dashboard:** A modern React-based UI for easy configuration and monitoring of your Plex integration.
-   **Built Specifically for Plex:** Seamlessly connects with your Plex server to fetch libraries and manage collections.
-   **3rd Party Integrations:** Easily connect to third party applications to automatically create and feature collections based off Trakt lists (IMDb, TMDb, TVDb, and more coming soon!) 
-   **Flexible Configuration:** Utilize either the Web UI or the YAML-based configuration file for detailed control over application settings and Plex interactions
-   **Containerized Deployment:** Easily deploy and manage the entire application using Docker and Docker Compose.

## Screenshots

### Dashboard View (Run rotations, see current pinned Collections and history)
<img width="1803" height="1281" alt="image" src="https://github.com/user-attachments/assets/f588cdf5-01a7-48ba-a68d-b4716d5b77c0" />

### Collection Groups (View all groups/edit group names)
<img width="1815" height="1070" alt="image" src="https://github.com/user-attachments/assets/561f5c0c-17bd-47af-bfed-34f87f348c01" />

### Edit Collection Groups (Edit rules, add collections, etc.)
<img width="1683" height="1986" alt="edit_collections" src="https://github.com/user-attachments/assets/e2d64a4c-1e23-493e-b328-2b4eef4be2d4" />

### Settings Page (Edit Plex/Trakt Connections and add Trakt Lists)
<img width="1691" height="1760" alt="settings" src="https://github.com/user-attachments/assets/afe26b0d-1e39-48c9-86f0-056704ffac53" />





## 🛠️ Tech Stack

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
-   A Trakt API Key (Not required, more info [here](https://trakt.tv/oauth/applications))

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/trentferguson/homescreen-hero.git
    cd homescreen-hero
    ```

2.  **Configure HomeScreen Hero**

    a. **Create configuration file:**
    ```bash
    mkdir -p data
    cp example.config.yaml data/config.yaml
    ```

    b. **Set up environment variables (recommended for security):**
    ```bash
    cp .env.example .env
    ```
    Edit `.env` and fill in your sensitive values:
    - `HSH_PLEX_TOKEN`: Your Plex authentication token ([how to find it](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/))
    - `HSH_AUTH_PASSWORD`: Your desired admin password (if enabling auth)
    - `HSH_AUTH_SECRET_KEY`: Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
    - `HSH_TRAKT_CLIENT_ID`: Your Trakt API key (if using Trakt) ([how to get it](https://forums.trakt.tv/t/where-do-i-find-the-api-key/60064))

    c. **Edit config.yaml:**
    Open `data/config.yaml` and configure non-sensitive settings:
    - `plex.base_url`: Your Plex Media Server URL (e.g., `http://192.168.1.100:32400`)
    - `plex.library_name`: The library to manage (e.g., "Movies")
    - `rotation` settings: interval, max collections, strategy
    - `groups`: Define your collection groups

    **Note:** Sensitive values (tokens, passwords) should be in `.env`, not in `config.yaml`

3.  **Start the application with Docker Compose**
    ```bash
    docker-compose up -d
    ```
    This command will build the frontend, create the backend service, and any other necessary services (like a database, if configured) and run them in detached mode.

4.  **Open your browser**
    The web dashboard will be accessible at `http://localhost:[DETECTED_UI_PORT]` or `http://localhost:[DETECTED_FASTAPI_PORT]` depending on your `docker-compose.yml` configuration.
    <!-- TODO: Specify the exact default port from docker-compose.yml, typically 8000 for FastAPI. -->
    Visit `http://localhost:8000` (common FastAPI default)

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
  library_name: "YOUR_PLEX_LIBRARY_NAME"
rotation:
  enabled: true
  interval_hours: 12
  max_collections: 5
  strategy: random
  allow_repeats: false
trakt:
  enabled: false
  client_id: "YOUR_TRAKT_CLIENT_ID"
  base_url: https://api.trakt.tv
  sources:
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
- **rotation** – Enable/disable scheduling, interval hours, max collections, strategy, and repeat rules.
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


##  Deployment

The recommended deployment method for HomeScreen Hero is using Docker and Docker Compose.

### Production Build

The `docker-compose.yml` file is configured to build the frontend and backend images, integrating them into a single deployable unit. The frontend is typically built into static assets which are then served by the backend or a dedicated web server within the container.

### Deployment Options

-   **Docker Compose:**
    The provided `docker-compose.yml` is the primary method for deploying the application.
    ```bash
    docker-compose up -d
    ```
    To update the application to a new version:
    ```bash
    docker-compose pull
    docker-compose up -d --build --force-recreate
    ```
-   **Kubernetes/Other Orchestrators:**
    While not directly provided, the Docker images can be adapted for deployment on Kubernetes or other container orchestration platforms.

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
-   **Chat GPT & Github Copilot:** For building ~90% of my frontend. As a Data Engineer, a big part of creating this app for myself was to get a true understanding of where AI Coding Agents stand today, and what exactly they can/cannot do. I got tired of the headlines/Reddit comments and figured this was the quickest way to the truth.

## 🐶 Puppy Tax 
I'm not ashamed to use my cutie for free internet points! (*she was also great moral support on the "I've been banging my head against a wall for days trying to figure out why the rotation runs every thirty seconds lol*)

<img width="25%" height="25%" alt="IMG_3015" src="https://github.com/user-attachments/assets/e24b34da-b541-4ead-b822-98ec31b5154e" />
<img width="25%" height="25%" alt="IMG_1225" src="https://github.com/user-attachments/assets/a4b6ad17-063b-4068-ac2d-91ec60f117f2" />
<img width="25%" height="25%" alt="IMG_3017" src="https://github.com/user-attachments/assets/300e1e92-ea19-4dc0-8dfc-8a17413725c6" />

---

<div align="center">

**⭐ Star this repo if you find it helpful!**

Made with ❤️ by [trentferguson](https://github.com/trentferguson)

</div>
```

