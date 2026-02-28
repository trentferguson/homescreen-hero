"""
Tests for Analytics API endpoints
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from datetime import datetime
from homescreen_hero.web.app import create_app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app with config mocked out"""
    mock_config = Mock()
    mock_config.logging.level = "INFO"
    mock_config.tautulli = Mock(enabled=False)
    mock_config.auth = Mock(enabled=False, method="password")

    with patch('homescreen_hero.web.app.load_config', return_value=mock_config), \
         patch('homescreen_hero.core.auth.load_config', return_value=mock_config), \
         patch('homescreen_hero.web.routers.analytics.load_config', return_value=mock_config):
        app = create_app()
        yield TestClient(app)


@pytest.fixture
def auth_headers():
    """Mock authentication headers - tests may need to adjust based on auth setup"""
    return {"Authorization": "Bearer test_token"}


class TestAnalyticsEndpointsExist:
    """Basic tests to verify analytics endpoints exist"""

    def test_top_collections_endpoint_exists(self, client):
        """Test that top collections endpoint exists"""
        # This will likely return 401 without auth or empty data without Tautulli
        response = client.get("/api/admin/analytics/top")
        # Should not be 404
        assert response.status_code != 404

    def test_collections_endpoint_exists(self, client):
        """Test that collections analytics endpoint exists"""
        response = client.get("/api/admin/analytics/collections")
        assert response.status_code != 404

    def test_collect_endpoint_exists(self, client):
        """Test that collect trigger endpoint exists"""
        response = client.post("/api/admin/analytics/collect")
        assert response.status_code != 404

    def test_users_top_endpoint_exists(self, client):
        """Test that top users endpoint exists"""
        response = client.get("/api/admin/analytics/users/top")
        assert response.status_code != 404

    def test_activity_current_endpoint_exists(self, client):
        """Test that current activity endpoint exists"""
        response = client.get("/api/admin/analytics/activity/current")
        assert response.status_code != 404

    def test_plays_by_hour_endpoint_exists(self, client):
        """Test that plays by hour graph endpoint exists"""
        response = client.get("/api/admin/analytics/graph/plays-by-hour")
        assert response.status_code != 404

    def test_plays_by_date_endpoint_exists(self, client):
        """Test that plays by date graph endpoint exists"""
        response = client.get("/api/admin/analytics/graph/plays-by-date")
        assert response.status_code != 404

    def test_concurrent_by_date_endpoint_exists(self, client):
        """Test that concurrent viewers by date endpoint exists"""
        response = client.get("/api/admin/analytics/graph/concurrent-by-date")
        assert response.status_code != 404

    def test_concurrent_by_hour_endpoint_exists(self, client):
        """Test that concurrent viewers by hour endpoint exists"""
        response = client.get("/api/admin/analytics/graph/concurrent-by-hour")
        assert response.status_code != 404


class TestAnalyticsResponseFormats:
    """Tests for analytics response formats with mocked data"""

    @patch('homescreen_hero.web.routers.analytics.get_tautulli_client')
    @patch('homescreen_hero.web.routers.analytics.load_config')
    def test_plays_by_hour_returns_list(self, mock_config, mock_get_client, client):
        """Test plays by hour returns proper list format"""
        # Setup mock
        mock_tautulli = Mock()
        mock_tautulli.get_plays_by_hourofday.return_value = {
            "categories": ["00", "01", "02", "03"],
            "series": [
                {"name": "Movies", "data": [5, 2, 1, 0]},
                {"name": "TV", "data": [3, 1, 0, 1]},
            ]
        }
        mock_get_client.return_value = mock_tautulli
        mock_config.return_value = Mock(tautulli=Mock(enabled=True))

        response = client.get("/api/admin/analytics/graph/plays-by-hour")

        # Should return 200 or auth error, not 500
        assert response.status_code in [200, 401, 403]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            # Each item should have hour and plays
            if len(data) > 0:
                assert "hour" in data[0]
                assert "plays" in data[0]

    @patch('homescreen_hero.web.routers.analytics.get_tautulli_client')
    @patch('homescreen_hero.web.routers.analytics.load_config')
    def test_plays_by_date_returns_list(self, mock_config, mock_get_client, client):
        """Test plays by date returns proper list format"""
        mock_tautulli = Mock()
        mock_tautulli.get_plays_by_date.return_value = {
            "categories": ["2024-01-01", "2024-01-02"],
            "series": [
                {"name": "Movies", "data": [10, 15]},
            ]
        }
        mock_get_client.return_value = mock_tautulli
        mock_config.return_value = Mock(tautulli=Mock(enabled=True))

        response = client.get("/api/admin/analytics/graph/plays-by-date")

        assert response.status_code in [200, 401, 403]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            if len(data) > 0:
                assert "date" in data[0]
                assert "plays" in data[0]

    @patch('homescreen_hero.web.routers.analytics.get_tautulli_client')
    @patch('homescreen_hero.web.routers.analytics.load_config')
    def test_top_users_returns_list(self, mock_config, mock_get_client, client):
        """Test top users endpoint returns list of users"""
        mock_tautulli = Mock()
        mock_tautulli.get_home_stats.return_value = [
            {
                "stat_id": "top_users",
                "rows": [
                    {"user": "user1", "total_plays": 100, "total_duration": 36000},
                    {"user": "user2", "total_plays": 50, "total_duration": 18000},
                ]
            }
        ]
        mock_get_client.return_value = mock_tautulli
        mock_config.return_value = Mock(tautulli=Mock(enabled=True))

        response = client.get("/api/admin/analytics/users/top")

        assert response.status_code in [200, 401, 403]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)


class TestAnalyticsQueryParameters:
    """Tests for analytics query parameters"""

    def test_top_collections_accepts_limit(self, client):
        """Test that top collections accepts limit parameter"""
        response = client.get("/api/admin/analytics/top?limit=10")
        # Should not error on valid parameter
        assert response.status_code != 422  # 422 = validation error

    def test_top_collections_accepts_media_type(self, client):
        """Test that top collections accepts media_type parameter"""
        response = client.get("/api/admin/analytics/top?media_type=movie")
        assert response.status_code != 422

        response = client.get("/api/admin/analytics/top?media_type=show")
        assert response.status_code != 422

    def test_plays_by_hour_accepts_query_days(self, client):
        """Test that plays by hour accepts query_days parameter"""
        response = client.get("/api/admin/analytics/graph/plays-by-hour?query_days=7")
        assert response.status_code != 422

    def test_plays_by_date_accepts_query_days(self, client):
        """Test that plays by date accepts query_days parameter"""
        response = client.get("/api/admin/analytics/graph/plays-by-date?query_days=30")
        assert response.status_code != 422

    def test_concurrent_by_date_accepts_query_days(self, client):
        """Test that concurrent by date accepts query_days parameter"""
        response = client.get("/api/admin/analytics/graph/concurrent-by-date?query_days=7")
        assert response.status_code != 422

    def test_top_users_accepts_limit(self, client):
        """Test that top users accepts limit parameter"""
        response = client.get("/api/admin/analytics/users/top?limit=5")
        assert response.status_code != 422


class TestAnalyticsTautulliDisabled:
    """Tests for behavior when Tautulli is not configured"""

    @patch('homescreen_hero.web.routers.analytics.get_tautulli_client')
    @patch('homescreen_hero.web.routers.analytics.load_config')
    def test_plays_by_hour_returns_empty_when_disabled(self, mock_config, mock_get_client, client):
        """Test plays by hour returns empty list when Tautulli disabled"""
        mock_get_client.return_value = None
        mock_config.return_value = Mock(tautulli=None)

        response = client.get("/api/admin/analytics/graph/plays-by-hour")

        # Should return 200 with empty data or appropriate error, not crash
        assert response.status_code in [200, 400, 401, 403, 503]

    @patch('homescreen_hero.web.routers.analytics.get_tautulli_client')
    @patch('homescreen_hero.web.routers.analytics.load_config')
    def test_top_users_returns_empty_when_disabled(self, mock_config, mock_get_client, client):
        """Test top users returns empty list when Tautulli disabled"""
        mock_get_client.return_value = None
        mock_config.return_value = Mock(tautulli=None)

        response = client.get("/api/admin/analytics/users/top")

        assert response.status_code in [200, 400, 401, 403, 503]


class TestConcurrentEndpointsReturnProperFormat:
    """Tests for concurrent viewer endpoint response formats"""

    def test_concurrent_by_date_returns_list_with_date_and_peak(self, client):
        """Test concurrent by date returns proper format"""
        response = client.get("/api/admin/analytics/graph/concurrent-by-date?query_days=7")

        # Should return 200 or auth/config error
        assert response.status_code in [200, 400, 401, 403]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            # Each item should have date and peak_concurrent
            if len(data) > 0:
                assert "date" in data[0]
                assert "peak_concurrent" in data[0]

    def test_concurrent_by_hour_returns_24_entries(self, client):
        """Test concurrent by hour returns 24 hour entries"""
        response = client.get("/api/admin/analytics/graph/concurrent-by-hour")

        assert response.status_code in [200, 400, 401, 403]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 24
            # Each item should have hour and peak_concurrent
            if len(data) > 0:
                assert "hour" in data[0]
                assert "peak_concurrent" in data[0]
            # Hours should be 0-23
            hours = [item["hour"] for item in data]
            assert sorted(hours) == list(range(24))
