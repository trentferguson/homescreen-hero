# launcher.py - Entry point for portable Windows build
# Adds the app folder to sys.path before starting uvicorn

import sys
import os

# Get the directory where this script lives
root = os.path.dirname(os.path.abspath(__file__))

# Add app folder to path so homescreen_hero can be imported
app_path = os.path.join(root, "app")
if app_path not in sys.path:
    sys.path.insert(0, app_path)

# Load .env file if it exists
from dotenv import load_dotenv

env_file = os.path.join(root, ".env")
if os.path.exists(env_file):
    load_dotenv(env_file)

# Set environment variables if not already set
data_path = os.path.join(root, "data")
os.makedirs(data_path, exist_ok=True)

if "HOMESCREEN_HERO_CONFIG" not in os.environ:
    os.environ["HOMESCREEN_HERO_CONFIG"] = os.path.join(data_path, "config.yaml")
if "HOMESCREEN_HERO_DB" not in os.environ:
    os.environ["HOMESCREEN_HERO_DB"] = (
        f"sqlite:///{os.path.join(data_path, 'homescreen_hero.sqlite')}"
    )
if "HOMESCREEN_HERO_LOG_DIR" not in os.environ:
    os.environ["HOMESCREEN_HERO_LOG_DIR"] = os.path.join(data_path, "logs")

# Get port from environment variable, default to 8000
port = int(os.environ.get("HSH_PORT", "8000"))

# Start uvicorn
import uvicorn

uvicorn.run("homescreen_hero.web.app:app", host="127.0.0.1", port=port)
