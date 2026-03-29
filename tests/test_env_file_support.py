"""
Tests for _FILE suffix support (Docker secrets) in env var resolution.
"""
import pytest
from homescreen_hero.core.config.loader import _resolve_env, _apply_env_overrides
from homescreen_hero.core.config.schema import AppConfig, PlexSettings, RotationSettings


class TestResolveEnv:
    """Tests for _resolve_env() helper."""

    def test_returns_none_when_neither_set(self, monkeypatch):
        monkeypatch.delenv("HSH_TEST_VAR", raising=False)
        monkeypatch.delenv("HSH_TEST_VAR_FILE", raising=False)
        assert _resolve_env("HSH_TEST_VAR") is None

    def test_returns_env_var_value(self, monkeypatch):
        monkeypatch.setenv("HSH_TEST_VAR", "my-secret")
        monkeypatch.delenv("HSH_TEST_VAR_FILE", raising=False)
        assert _resolve_env("HSH_TEST_VAR") == "my-secret"

    def test_reads_file_content(self, monkeypatch, tmp_path):
        secret_file = tmp_path / "secret.txt"
        secret_file.write_text("file-secret")
        monkeypatch.delenv("HSH_TEST_VAR", raising=False)
        monkeypatch.setenv("HSH_TEST_VAR_FILE", str(secret_file))
        assert _resolve_env("HSH_TEST_VAR") == "file-secret"

    def test_strips_whitespace_from_file(self, monkeypatch, tmp_path):
        secret_file = tmp_path / "secret.txt"
        secret_file.write_text("  file-secret  \n\n")
        monkeypatch.delenv("HSH_TEST_VAR", raising=False)
        monkeypatch.setenv("HSH_TEST_VAR_FILE", str(secret_file))
        assert _resolve_env("HSH_TEST_VAR") == "file-secret"

    def test_errors_when_both_set(self, monkeypatch, tmp_path):
        secret_file = tmp_path / "secret.txt"
        secret_file.write_text("file-secret")
        monkeypatch.setenv("HSH_TEST_VAR", "env-secret")
        monkeypatch.setenv("HSH_TEST_VAR_FILE", str(secret_file))
        with pytest.raises(ValueError, match="Both HSH_TEST_VAR and HSH_TEST_VAR_FILE are set"):
            _resolve_env("HSH_TEST_VAR")

    def test_errors_when_file_missing(self, monkeypatch, tmp_path):
        monkeypatch.delenv("HSH_TEST_VAR", raising=False)
        monkeypatch.setenv("HSH_TEST_VAR_FILE", str(tmp_path / "nonexistent.txt"))
        with pytest.raises(ValueError, match="not a readable file"):
            _resolve_env("HSH_TEST_VAR")

    def test_errors_when_file_empty(self, monkeypatch, tmp_path):
        secret_file = tmp_path / "secret.txt"
        secret_file.write_text("   \n")
        monkeypatch.delenv("HSH_TEST_VAR", raising=False)
        monkeypatch.setenv("HSH_TEST_VAR_FILE", str(secret_file))
        with pytest.raises(ValueError, match="which is empty"):
            _resolve_env("HSH_TEST_VAR")


# Clear all HSH_ env vars to avoid interference from the host environment
ENV_VARS_TO_CLEAR = [
    "HSH_PLEX_URL", "HSH_PLEX_URL_FILE",
    "HSH_PLEX_TOKEN", "HSH_PLEX_TOKEN_FILE",
    "HSH_AUTH_PASSWORD", "HSH_AUTH_PASSWORD_FILE",
    "HSH_AUTH_SECRET_KEY", "HSH_AUTH_SECRET_KEY_FILE",
    "HSH_TRAKT_CLIENT_ID", "HSH_TRAKT_CLIENT_ID_FILE",
    "HSH_MDBLIST_API_KEY", "HSH_MDBLIST_API_KEY_FILE",
    "HSH_TMDB_API_KEY", "HSH_TMDB_API_KEY_FILE",
    "HSH_TAUTULLI_API_KEY", "HSH_TAUTULLI_API_KEY_FILE",
    "HSH_TAUTULLI_BASE_URL", "HSH_TAUTULLI_BASE_URL_FILE",
    "HSH_MAL_CLIENT_ID", "HSH_MAL_CLIENT_ID_FILE",
    "HSH_SEERR_API_KEY", "HSH_SEERR_API_KEY_FILE",
    "HSH_SEERR_BASE_URL", "HSH_SEERR_BASE_URL_FILE",
]


@pytest.fixture
def clean_env(monkeypatch):
    for key in ENV_VARS_TO_CLEAR:
        monkeypatch.delenv(key, raising=False)


class TestApplyEnvOverridesWithFile:
    """Integration tests: _apply_env_overrides works with _FILE variants."""

    def _make_config(self, **overrides):
        defaults = {
            "plex": PlexSettings(
                base_url="http://localhost:32400",
                token="config-token",
            ),
            "rotation": RotationSettings(),
            "groups": [],
        }
        defaults.update(overrides)
        return AppConfig(**defaults)

    def test_plex_token_from_file(self, monkeypatch, tmp_path, clean_env):
        secret_file = tmp_path / "plex_token"
        secret_file.write_text("file-token\n")
        monkeypatch.setenv("HSH_PLEX_TOKEN_FILE", str(secret_file))

        config = self._make_config(
            plex=PlexSettings(base_url="http://localhost:32400", token="config-token")
        )
        result = _apply_env_overrides(config)
        assert result.plex.token == "file-token"

    def test_plex_url_from_file(self, monkeypatch, tmp_path, clean_env):
        secret_file = tmp_path / "plex_url"
        secret_file.write_text("http://plex-from-file:32400\n")
        monkeypatch.setenv("HSH_PLEX_URL_FILE", str(secret_file))

        config = self._make_config(
            plex=PlexSettings(base_url="http://localhost:32400", token="tok")
        )
        result = _apply_env_overrides(config)
        assert result.plex.base_url == "http://plex-from-file:32400"

    def test_trakt_client_id_from_file(self, monkeypatch, tmp_path, clean_env):
        secret_file = tmp_path / "trakt_id"
        secret_file.write_text("trakt-from-file\n")
        monkeypatch.setenv("HSH_TRAKT_CLIENT_ID_FILE", str(secret_file))

        config = self._make_config()
        result = _apply_env_overrides(config)
        assert result.trakt is not None
        assert result.trakt.client_id == "trakt-from-file"
        assert result.trakt.enabled is True
