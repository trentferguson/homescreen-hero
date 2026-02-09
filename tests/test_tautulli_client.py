"""
Tests for Tautulli client
"""
import pytest
from unittest.mock import Mock, patch
import requests
from homescreen_hero.core.integrations.tautulli_client import (
    TautulliClient,
    TautulliConfig,
    get_tautulli_client,
)
from homescreen_hero.core.config.schema import (
    AppConfig,
    TautulliSettings,
    PlexSettings,
    RotationSettings,
    CollectionGroupConfig,
)


@pytest.fixture
def tautulli_config():
    """Tautulli configuration fixture"""
    return TautulliConfig(
        api_key="test_api_key_123",
        base_url="http://localhost:8181"
    )


@pytest.fixture
def tautulli_client(tautulli_config):
    """Tautulli client fixture"""
    return TautulliClient(tautulli_config)


class TestTautulliConfig:
    """Tests for TautulliConfig"""

    def test_default_base_url(self):
        """Test default base URL"""
        config = TautulliConfig(api_key="test_key")
        assert config.base_url == "http://localhost:8181"
        assert config.api_key == "test_key"

    def test_custom_base_url(self):
        """Test custom base URL"""
        config = TautulliConfig(
            api_key="test_key",
            base_url="http://192.168.1.100:8181"
        )
        assert config.base_url == "http://192.168.1.100:8181"


class TestTautulliClient:
    """Tests for TautulliClient"""

    def test_client_initialization(self, tautulli_client, tautulli_config):
        """Test that client initializes correctly"""
        assert tautulli_client.cfg == tautulli_config
        assert tautulli_client.session is not None

    def test_build_url(self, tautulli_client):
        """Test URL building with command and params"""
        url = tautulli_client._build_url("get_activity")
        assert "http://localhost:8181/api/v2" in url
        assert "apikey=test_api_key_123" in url
        assert "cmd=get_activity" in url

    def test_build_url_with_params(self, tautulli_client):
        """Test URL building with additional parameters"""
        url = tautulli_client._build_url("get_history", params={"length": "100"})
        assert "apikey=test_api_key_123" in url
        assert "cmd=get_history" in url
        assert "length=100" in url

    def test_build_url_trailing_slash(self):
        """Test URL building handles trailing slash on base URL"""
        config = TautulliConfig(
            api_key="test_key",
            base_url="http://localhost:8181/"
        )
        client = TautulliClient(config)
        url = client._build_url("get_activity")
        assert "http://localhost:8181/api/v2" in url
        assert "//" not in url.replace("http://", "")

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_ping_success(self, mock_get, tautulli_client):
        """Test successful ping"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "success",
                "data": {"stream_count": 0}
            }
        }
        mock_get.return_value = mock_response

        success, error = tautulli_client.ping()

        assert success is True
        assert error is None
        mock_get.assert_called_once()

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_ping_timeout(self, mock_get, tautulli_client):
        """Test ping timeout"""
        mock_get.side_effect = requests.Timeout("Connection timeout")

        success, error = tautulli_client.ping()

        assert success is False
        assert "timed out" in error.lower()

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_ping_unauthorized(self, mock_get, tautulli_client):
        """Test ping with invalid API key"""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = requests.HTTPError(response=mock_response)
        mock_get.return_value = mock_response

        success, error = tautulli_client.ping()

        assert success is False
        assert "unauthorized" in error.lower() or "401" in error

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_ping_api_error(self, mock_get, tautulli_client):
        """Test ping with Tautulli API error response"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "error",
                "message": "Invalid API key"
            }
        }
        mock_get.return_value = mock_response

        success, error = tautulli_client.ping()

        assert success is False
        assert error is not None

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_request_json_response(self, mock_get, tautulli_client):
        """Test request with JSON response unwraps Tautulli format"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "success",
                "data": {"test": "value"}
            }
        }
        mock_get.return_value = mock_response

        result = tautulli_client._request("get_activity")

        assert result == {"test": "value"}

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_get_libraries(self, mock_get, tautulli_client):
        """Test get_libraries returns library list"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "success",
                "data": {
                    "data": [
                        {"section_id": 1, "section_name": "Movies"},
                        {"section_id": 2, "section_name": "TV Shows"},
                    ]
                }
            }
        }
        mock_get.return_value = mock_response

        result = tautulli_client.get_libraries()

        assert len(result) == 2
        assert result[0]["section_name"] == "Movies"

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_get_collection_stats(self, mock_get, tautulli_client):
        """Test get_collection_stats returns play stats"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "success",
                "data": [
                    {"total_plays": 42, "total_duration": 3600}
                ]
            }
        }
        mock_get.return_value = mock_response

        result = tautulli_client.get_collection_stats(rating_key=12345)

        assert result["total_plays"] == 42
        assert result["total_duration"] == 3600

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_get_collection_stats_empty(self, mock_get, tautulli_client):
        """Test get_collection_stats handles empty response"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "success",
                "data": []
            }
        }
        mock_get.return_value = mock_response

        result = tautulli_client.get_collection_stats(rating_key=99999)

        assert result["total_plays"] == 0
        assert result["total_duration"] is None

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_get_plays_by_date(self, mock_get, tautulli_client):
        """Test get_plays_by_date returns graph data"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "success",
                "data": {
                    "categories": ["2024-01-01", "2024-01-02"],
                    "series": [{"name": "Movies", "data": [10, 15]}]
                }
            }
        }
        mock_get.return_value = mock_response

        result = tautulli_client.get_plays_by_date(time_range=7)

        assert "categories" in result
        assert "series" in result
        assert len(result["categories"]) == 2

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_get_plays_by_hourofday(self, mock_get, tautulli_client):
        """Test get_plays_by_hourofday returns hourly data"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "success",
                "data": {
                    "categories": ["00", "01", "02"],
                    "series": [{"name": "Movies", "data": [5, 2, 1]}]
                }
            }
        }
        mock_get.return_value = mock_response

        result = tautulli_client.get_plays_by_hourofday(time_range=30)

        assert "categories" in result
        assert "series" in result

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_get_history(self, mock_get, tautulli_client):
        """Test get_history returns history entries"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "success",
                "data": {
                    "data": [
                        {"id": 1, "title": "Movie 1", "started": 1704067200},
                        {"id": 2, "title": "Movie 2", "started": 1704070800},
                    ]
                }
            }
        }
        mock_get.return_value = mock_response

        result = tautulli_client.get_history(length=100)

        assert len(result) == 2
        assert result[0]["title"] == "Movie 1"

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_get_home_stats(self, mock_get, tautulli_client):
        """Test get_home_stats returns statistics"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {
            "response": {
                "result": "success",
                "data": [
                    {"stat_id": "top_users", "rows": [{"user": "test_user", "total_plays": 100}]}
                ]
            }
        }
        mock_get.return_value = mock_response

        result = tautulli_client.get_home_stats(time_range=30)

        assert isinstance(result, list)
        assert len(result) > 0

    @patch('homescreen_hero.core.integrations.tautulli_client.requests.Session.get')
    def test_request_connection_error(self, mock_get, tautulli_client):
        """Test handling of connection errors"""
        mock_get.side_effect = requests.ConnectionError("Connection refused")

        success, error = tautulli_client.ping()

        assert success is False
        assert "connection" in error.lower() or "refused" in error.lower()


def _make_config(tautulli=None):
    """Helper to create a valid AppConfig with required fields"""
    return AppConfig(
        plex=PlexSettings(base_url="http://localhost:32400", token="test"),
        rotation=RotationSettings(
            enabled=True,
            interval_hours=12,
            max_collections=5,
            strategy="random",
        ),
        groups=[
            CollectionGroupConfig(
                name="Test",
                enabled=True,
                min_picks=1,
                max_picks=2,
                weight=1,
                collections=["Test Collection"],
            )
        ],
        tautulli=tautulli,
    )


class TestGetTautulliClient:
    """Tests for get_tautulli_client factory function"""

    def test_returns_none_when_not_configured(self):
        """Test returns None when Tautulli not in config"""
        config = _make_config(tautulli=None)
        client = get_tautulli_client(config)
        assert client is None

    def test_returns_none_when_disabled(self):
        """Test returns None when Tautulli is disabled"""
        config = _make_config(
            tautulli=TautulliSettings(
                enabled=False,
                api_key="test_key",
                base_url="http://localhost:8181",
            )
        )
        client = get_tautulli_client(config)
        assert client is None

    def test_returns_none_when_api_key_missing(self):
        """Test returns None when API key is missing"""
        config = _make_config(
            tautulli=TautulliSettings(
                enabled=True,
                api_key="",
                base_url="http://localhost:8181",
            )
        )
        client = get_tautulli_client(config)
        assert client is None

    def test_returns_client_when_configured(self):
        """Test returns client when properly configured"""
        config = _make_config(
            tautulli=TautulliSettings(
                enabled=True,
                api_key="valid_api_key",
                base_url="http://localhost:8181",
            )
        )
        client = get_tautulli_client(config)
        assert client is not None
        assert isinstance(client, TautulliClient)
        assert client.cfg.api_key == "valid_api_key"
