"""
Tests for health API endpoints
"""
import pytest
from fastapi.testclient import TestClient
from homescreen_hero.web.app import create_app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app"""
    app = create_app()
    return TestClient(app)


class TestHealthEndpointBasic:
    """Basic tests for /api/health endpoint"""

    def test_health_endpoint_exists(self, client):
        """Test that health endpoint exists and returns 200"""
        response = client.get("/api/health")

        # Should return successfully
        assert response.status_code == 200

    def test_health_returns_json(self, client):
        """Test that health endpoint returns JSON"""
        response = client.get("/api/health")

        assert response.status_code == 200
        # Should be valid JSON
        data = response.json()
        assert isinstance(data, dict)

    def test_health_has_ok_or_components(self, client):
        """Test that health response has ok status or components"""
        response = client.get("/api/health")

        assert response.status_code == 200
        data = response.json()

        # Should have an ok status or components
        assert "ok" in data or "components" in data
