from pathlib import Path
from textwrap import dedent

import pytest
from fastapi.testclient import TestClient

from homescreen_hero.core.config import loader
from homescreen_hero.web.app import create_app


CONFIG_TEXT = dedent(
    """
    plex:
      base_url: http://localhost:32400
      token: test-token
    rotation:
      enabled: false
    groups:
      - name: Existing group
        collections: [Existing collection]
    auth:
      enabled: true
      method: password
      username: admin
      password: test-password
      secret_key: test-secret-key
    """
).strip()

QUICK_START = {
    "plex_url": "http://localhost:32400",
    "plex_token": "test-token",
    "libraries": ["Movies"],
    "auth_method": "password",
    "auth_username": "admin",
    "auth_password": "test-password",
}


@pytest.fixture
def config_locations(tmp_path, monkeypatch):
    app_dir = tmp_path / "app"
    app_dir.mkdir()
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    monkeypatch.chdir(app_dir)
    monkeypatch.delenv(loader.CONFIG_ENV_VAR, raising=False)
    monkeypatch.setattr(loader, "DEFAULT_CONFIG_PATH", Path("config.yaml"))
    monkeypatch.setattr(
        loader, "DATA_CONFIG_PATH", data_dir / "config.yaml", raising=False
    )
    monkeypatch.setattr(loader, "_cached_config", None)
    monkeypatch.setattr(loader, "_cached_config_path", None)
    return app_dir / "config.yaml", data_dir / "config.yaml"


def test_loads_existing_data_volume_config(config_locations):
    local_path, data_path = config_locations
    data_path.write_text(CONFIG_TEXT, encoding="utf-8")

    assert loader.get_config_path() == data_path
    assert loader.load_config().groups[0].name == "Existing group"
    assert loader.load_config_text() == CONFIG_TEXT
    assert not local_path.exists()


def test_working_directory_config_takes_precedence(config_locations):
    local_path, data_path = config_locations
    local_path.write_text(CONFIG_TEXT, encoding="utf-8")
    data_path.write_text("invalid: [yaml", encoding="utf-8")

    assert loader.get_config_path() == local_path
    assert loader.load_config_text() == CONFIG_TEXT


@pytest.mark.parametrize("exists", [False, True])
def test_environment_override_takes_precedence(
    config_locations, tmp_path, monkeypatch, exists
):
    local_path, data_path = config_locations
    local_path.write_text(CONFIG_TEXT, encoding="utf-8")
    data_path.write_text(CONFIG_TEXT, encoding="utf-8")
    override_path = tmp_path / "override.yaml"
    if exists:
        override_path.write_text("override: true", encoding="utf-8")
    monkeypatch.setenv(loader.CONFIG_ENV_VAR, str(override_path))

    assert loader.get_config_path() == override_path
    if exists:
        assert loader.load_config_text() == "override: true"
    else:
        with pytest.raises(FileNotFoundError):
            loader.load_config_text()


def test_explicit_path_takes_precedence(config_locations, tmp_path, monkeypatch):
    local_path, data_path = config_locations
    local_path.write_text(CONFIG_TEXT, encoding="utf-8")
    data_path.write_text(CONFIG_TEXT, encoding="utf-8")
    monkeypatch.setenv(loader.CONFIG_ENV_VAR, str(data_path))
    explicit_path = tmp_path / "explicit.yaml"
    explicit_path.write_text("explicit: true", encoding="utf-8")

    assert loader.get_config_path(explicit_path) == explicit_path
    assert loader.load_config_text(explicit_path) == "explicit: true"


def test_save_updates_discovered_config(config_locations):
    local_path, data_path = config_locations
    data_path.write_text(CONFIG_TEXT, encoding="utf-8")
    updated_text = CONFIG_TEXT.replace("Existing group", "Updated group")

    loader.save_config_text(updated_text)

    assert data_path.read_text(encoding="utf-8") == updated_text
    assert loader.load_config().groups[0].name == "Updated group"
    assert not local_path.exists()


def test_invalid_data_volume_config_is_not_silently_ignored(config_locations):
    local_path, data_path = config_locations
    data_path.write_text("invalid: [yaml", encoding="utf-8")

    with pytest.raises(ValueError, match="Invalid YAML"):
        loader.load_config()

    assert data_path.read_text(encoding="utf-8") == "invalid: [yaml"
    assert not local_path.exists()


def test_discovered_config_locks_initial_setup(config_locations):
    local_path, data_path = config_locations
    data_path.write_text(CONFIG_TEXT, encoding="utf-8")
    original_bytes = data_path.read_bytes()
    client = TestClient(create_app())

    response = client.get("/api/admin/config/exists")
    assert response.status_code == 200
    assert response.json()["is_configured"] is True

    response = client.post("/api/admin/config/quick-start", json=QUICK_START)
    assert response.status_code == 403
    assert "Initial setup has already been completed" in response.json()["detail"]
    assert client.get("/api/admin/config/env-vars").status_code == 401
    assert data_path.read_bytes() == original_bytes
    assert not local_path.exists()


def test_fresh_setup_still_uses_working_directory(config_locations):
    local_path, data_path = config_locations
    assert loader.get_config_path() == local_path
    client = TestClient(create_app())

    response = client.post("/api/admin/config/quick-start", json=QUICK_START)

    assert response.status_code == 200
    assert local_path.exists()
    assert not data_path.exists()
    assert loader.load_config().groups == []
