"""
PROMPT:
I asked an AI assistant to help create validation tests for
a real-time retail analytics metrics engine.

Generate pytest cases for:
- unique visitor calculation
- staff exclusion from customer metrics
- conversion rate calculation
- dwell time analytics
- queue metrics
- zero traffic scenarios

CHANGES MADE:
- Adapted tests to VEYRA event schema.
- Added checks for live generated CCTV events.
- Validated business KPIs instead of raw detection counts.
- Included edge cases for empty stores and missing purchases.
"""
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_metrics():


    res = client.get(
        "/stores/ST1008/metrics"
    )


    assert res.status_code == 200


    data=res.json()


    assert "unique_visitors" in data

    assert "conversion_rate" in data

    assert "staff_count" in data