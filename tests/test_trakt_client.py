"""
Tests for Trakt client
"""
import pytest
from unittest.mock import Mock, patch
import requests
from homescreen_hero.core.integrations.trakt_client import TraktClient, TraktConfig


@pytest.fixture
def trakt_config():
    """Trakt configuration fixture"""
    return TraktConfig(
        client_id="test_client_id_123",
        base_url="https://api.trakt.tv"
    )


@pytest.fixture
def trakt_client(trakt_config):
    """Trakt client fixture"""
    return TraktClient(trakt_config)


class TestTraktClient:
    """Tests for TraktClient"""

    def test_client_initialization(self, trakt_client, trakt_config):
        """Test that client initializes with correct headers"""
        assert trakt_client.cfg == trakt_config
        assert trakt_client.session.headers["trakt-api-version"] == "2"
        assert trakt_client.session.headers["trakt-api-key"] == "test_client_id_123"
        assert trakt_client.session.headers["Content-Type"] == "application/json"

    def test_build_url(self, trakt_client):
        """Test URL building"""
        url = trakt_client._build_url("/movies/popular")
        assert url == "https://api.trakt.tv/movies/popular"

        # Test with leading slash
        url = trakt_client._build_url("movies/popular")
        assert url == "https://api.trakt.tv/movies/popular"

        # Test with trailing slash on base
        client = TraktClient(TraktConfig(
            client_id="test",
            base_url="https://api.trakt.tv/"
        ))
        url = client._build_url("/movies/popular")
        assert url == "https://api.trakt.tv/movies/popular"

    @patch('homescreen_hero.core.integrations.trakt_client.requests.Session.request')
    def test_ping_success(self, mock_request, trakt_client):
        """Test successful ping"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = [{"title": "Test Movie"}]
        mock_request.return_value = mock_response

        success, error = trakt_client.ping()

        assert success is True
        assert error is None
        mock_request.assert_called_once()

    @patch('homescreen_hero.core.integrations.trakt_client.requests.Session.request')
    def test_ping_timeout(self, mock_request, trakt_client):
        """Test ping timeout"""
        mock_request.side_effect = requests.Timeout("Connection timeout")

        success, error = trakt_client.ping()

        assert success is False
        assert "timed out" in error.lower()

    @patch('homescreen_hero.core.integrations.trakt_client.requests.Session.request')
    def test_ping_http_error(self, mock_request, trakt_client):
        """Test ping HTTP error"""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = requests.HTTPError("Unauthorized")
        mock_request.return_value = mock_response

        success, error = trakt_client.ping()

        assert success is False
        assert error is not None

    @patch('homescreen_hero.core.integrations.trakt_client.requests.Session.request')
    def test_request_json_response(self, mock_request, trakt_client):
        """Test request with JSON response"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = {"data": "test"}
        mock_request.return_value = mock_response

        result = trakt_client._request("GET", "/test/endpoint")

        assert result == {"data": "test"}
        mock_request.assert_called_once_with(
            method="GET",
            url="https://api.trakt.tv/test/endpoint",
            params=None,
            timeout=10.0
        )

    @patch('homescreen_hero.core.integrations.trakt_client.requests.Session.request')
    def test_request_text_response(self, mock_request, trakt_client):
        """Test request with text response"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "text/plain"}
        mock_response.text = "plain text response"
        mock_request.return_value = mock_response

        result = trakt_client._request("GET", "/test/endpoint")

        assert result == "plain text response"

    @patch('homescreen_hero.core.integrations.trakt_client.requests.Session.request')
    def test_request_with_params(self, mock_request, trakt_client):
        """Test request with query parameters"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.json.return_value = []
        mock_request.return_value = mock_response

        trakt_client._request("GET", "/movies", params={"page": 1, "limit": 10})

        mock_request.assert_called_once_with(
            method="GET",
            url="https://api.trakt.tv/movies",
            params={"page": 1, "limit": 10},
            timeout=10.0
        )

    @patch('homescreen_hero.core.integrations.trakt_client.requests.Session.request')
    def test_request_http_error_raises(self, mock_request, trakt_client):
        """Test that HTTP errors are raised"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.raise_for_status.side_effect = requests.HTTPError("Not Found")
        mock_request.return_value = mock_response

        with pytest.raises(requests.HTTPError):
            trakt_client._request("GET", "/not/found")


class TestTraktConfig:
    """Tests for TraktConfig"""

    def test_default_base_url(self):
        """Test default base URL"""
        config = TraktConfig(client_id="test_id")
        assert config.base_url == "https://api.trakt.tv"
        assert config.client_id == "test_id"

    def test_custom_base_url(self):
        """Test custom base URL"""
        config = TraktConfig(
            client_id="test_id",
            base_url="https://custom.trakt.tv"
        )
        assert config.base_url == "https://custom.trakt.tv"
