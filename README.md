

<div align="center">
<img width="400" height="270" alt="homescreen-hero_logo_text" src="https://github.com/user-attachments/assets/1904eb65-4d8c-4b85-8fd9-c3983e0488af" />


**A self-hosted web app that keeps your Plex home screen fresh by automatically rotating collections (scheduled or manual) via a modern FastAPI + React dashboard.**

<!-- TODO: Add live demo link if available -->
<!-- [Live Demo](https://demo-link.com) -->

</div>

## :exclamation:Disclaimer

This app is very much a work in progress. This started as a simple Python script to rotate my Plex homescreen, and turned in to much more. Please note, a good portion of this app is vibe-coded
(especially the frontend). While I went to school for full-stack software development, I ended up becoming a Data Engineer. The main part of creating this app was to further develop my Python skills, but then turned
into an experiment to see how much AI could assist me with building a fully self-hosted and usable application.

## Overview

HomeScreen Hero provides a powerful, self-hosted solution for Plex Media Server users to dynamically manage their home screen content. It empowers you to automate the rotation of Plex collections, ensuring your content recommendations stay fresh and engaging without manual intervention. The application features a sleek web dashboard built with React, facilitating easy configuration and control over your collection rotation schedules, all backed by a robust FastAPI backend.

## Features

-   **Automated Plex Collection Rotation:** Schedule collections to rotate on your Plex home screen at predefined intervals.
-   **Manual Collection Rotation:** Trigger instant rotation of collections directly from the web dashboard.
-   **Intuitive Web Dashboard:** A modern React-based UI for easy configuration and monitoring of your Plex integration.
-   **Plex Media Server Integration:** Seamlessly connects with your Plex server to fetch libraries and manage collections.
-   **Flexible Configuration:** Utilize a YAML-based configuration file for detailed control over application settings and Plex interactions, or configure settings in the Web UI.
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
<!-- TODO: Detect and add specific styling framework (e.g., Tailwind CSS, Styled Components) and build tool (e.g., Vite) -->

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
    - The application uses `config.yaml` for its settings. A sample file is provided (*example.config.yaml*), as well as an example down below:
    ```bash
    create /data folder in root directory and place your config.yaml file inside of it
    ```
    Open `config.yaml` and adjust the settings according to your Plex Media Server and desired rotation logic. Key settings will include:
    -   `base_url`: Your Plex Media Server URL (e.g., `http://192.168.1.100:32400`)
    -   `token`: Your Plex authentication token. (more info [here](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/))
    -   `LOG_LEVEL`: Logging verbosity. (INFO, ERROR, DEBUG, WARNING)
    -   `client_id` Your Trakt application API Key (more info [here](https://forums.trakt.tv/t/where-do-i-find-the-api-key/60064))
   <!-- TODO: List other critical configuration options from example.config.yaml -->

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
Environment variables can override paths for config (`HOMESCREEN_HERO_CONFIG`), database (`HOMESCREEN_HERO_DB`), and logs (`HOMESCREEN_HERO_LOG_DIR`). Health checks ping `/api/health` to confirm the API is ready.

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


## 🚀 Deployment

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

## 📚 API Reference

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

## 🤝 Contributing

We welcome contributions to HomeScreen Hero! If you're interested in improving the project, please refer to our contribution guidelines (once available).

### Development Setup for Contributors

Follow the **Development** section above to set up your local environment for both frontend and backend development.

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

-   **Agregarr:** For inspiring to try building something myself. Seriously, this app is awesome.
-   **ColleXions:** For initially doing exactly what I needed this app today. Another great inspiration for me to try my own hand at an app like this.

---

<div align="center">

**⭐ Star this repo if you find it helpful!**

Made with ❤️ by [trentferguson](https://github.com/trentferguson)

</div>
```

