"""Tests for first-run setup bootstrap behavior."""

from pathlib import Path
from shutil import rmtree
from textwrap import dedent
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from homescreen_hero.web.app import create_app


CONFIGURED_YAML = dedent(
    """
    plex:
      base_url: http://localhost:32400
      token: test-token
      libraries:
        - name: Movies
          enabled: true
    rotation:
      enabled: false
      interval_hours: 12
      max_collections: 5
      allow_repeats: false
    groups: []
    logging:
      level: INFO
    auth:
      enabled: true
      method: password
      username: admin
      password: test-password
      secret_key: test-secret-key
      token_expire_days: 30
    """
).strip()


@pytest.fixture
def config_path(monkeypatch):
    """Point config loading at an isolated temp file for each test."""
    temp_dir = Path("tests/.tmp") / uuid4().hex
    temp_dir.mkdir(parents=True, exist_ok=True)
    path = temp_dir / "config.yaml"
    monkeypatch.setenv("HOMESCREEN_HERO_CONFIG", str(path))
    for key in (
        "HSH_PLEX_URL",
        "HSH_PLEX_TOKEN",
        "HSH_AUTH_PASSWORD",
        "HSH_AUTH_SECRET_KEY",
        "HSH_TRAKT_CLIENT_ID",
        "HSH_MDBLIST_API_KEY",
        "HSH_TMDB_API_KEY",
        "HSH_TAUTULLI_API_KEY",
        "HSH_TAUTULLI_BASE_URL",
        "HSH_SEERR_API_KEY",
        "HSH_SEERR_BASE_URL",
        "HSH_MAL_CLIENT_ID",
    ):
        monkeypatch.delenv(key, raising=False)
    try:
        yield path
    finally:
        rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def client(config_path):
    """Create a FastAPI test client with an isolated config path."""
    app = create_app()
    return TestClient(app)


class TestSetupBootstrap:
    def test_exists_reports_unconfigured_before_first_setup(self, client):
        response = client.get("/api/admin/config/exists")

        assert response.status_code == 200
        assert response.json()["is_configured"] is False

    def test_exists_reports_unconfigured_when_config_file_is_invalid(self, client, config_path):
        config_path.write_text("not: [valid", encoding="utf-8")

        response = client.get("/api/admin/config/exists")

        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is True
        assert data["is_configured"] is False

    def test_quick_start_is_forbidden_after_config_file_exists(self, client, config_path):
        config_path.write_text(CONFIGURED_YAML, encoding="utf-8")

        response = client.post(
            "/api/admin/config/quick-start",
            json={
                "plex_url": "http://localhost:32400",
                "plex_token": "test-token",
                "libraries": ["Movies"],
                "auth_method": "password",
                "auth_username": "admin",
                "auth_password": "password123",
            },
        )

        assert response.status_code == 403
        assert "Initial setup has already been completed" in response.json()["detail"]

    def test_quick_start_recovers_from_invalid_config_and_backs_it_up(self, client, config_path):
        config_path.write_text("not: [valid", encoding="utf-8")

        response = client.post(
            "/api/admin/config/quick-start",
            json={
                "plex_url": "http://localhost:32400",
                "plex_token": "test-token",
                "libraries": ["Movies"],
                "auth_method": "password",
                "auth_username": "admin",
                "auth_password": "password123",
            },
        )

        assert response.status_code == 200
        assert config_path.with_suffix(".yaml.bak").read_text(encoding="utf-8") == "not: [valid"
        assert "Configuration initialized successfully" in response.json()["message"]

    def test_env_vars_is_public_during_first_setup(self, client):
        response = client.get("/api/admin/config/env-vars")

        assert response.status_code == 200
        assert "plex_token_from_env" in response.json()

    def test_test_endpoint_is_public_during_first_setup(self, client):
        response = client.post("/api/admin/config/test-trakt", json={})

        assert response.status_code == 200
        assert response.json() == {
            "ok": False,
            "error": "No Trakt Client ID provided",
            "libraries": None,
        }

    def test_env_vars_requires_auth_after_first_setup(self, client, config_path):
        config_path.write_text(CONFIGURED_YAML, encoding="utf-8")

        response = client.get("/api/admin/config/env-vars")

        assert response.status_code == 401

    def test_test_endpoint_requires_auth_after_first_setup(self, client, config_path):
        config_path.write_text(CONFIGURED_YAML, encoding="utf-8")

        response = client.post("/api/admin/config/test-trakt", json={})

        assert response.status_code == 401

    def test_auth_config_falls_back_gracefully_for_invalid_config(self, client, config_path):
        config_path.write_text("not: [valid", encoding="utf-8")

        response = client.get("/api/auth/config")

        assert response.status_code == 200
        assert response.json() == {
            "auth_enabled": False,
            "method": None,
        }

    def test_auth_me_rejects_requests_when_config_is_invalid(self, client, config_path):
        config_path.write_text("not: [valid", encoding="utf-8")

        response = client.get("/api/auth/me")

        assert response.status_code == 503
        assert "unavailable" in response.json()["detail"].lower()
