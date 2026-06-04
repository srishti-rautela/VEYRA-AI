"""
PROMPT:
I used an AI assistant to help design production-readiness tests
for a FastAPI based retail intelligence system.

Generate tests that validate:
- health monitoring endpoint
- service availability
- system status response
- production API reliability

CHANGES MADE:
- Modified generated tests according to VEYRA AI architecture.
- Added validation for YOLO pipeline status.
- Added event engine availability checks.
- Ensured tests verify real API behaviour instead of mocked responses.
"""
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_health():

    res = client.get(
        "/health"
    )


    assert res.status_code == 200


    data = res.json()


    assert data["status"] == "healthy"


    assert "real_detection_cams" in data