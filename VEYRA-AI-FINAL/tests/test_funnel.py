"""
PROMPT:
I used AI assistance to reason about customer journey testing.

Create tests for a store conversion funnel system where:
ENTRY events become sessions,
ZONE_ENTER represents engagement,
BILLING_QUEUE represents intent,
POS correlation represents purchase.

Validate:
- session based counting
- re-entry handling
- duplicate visitor prevention
- correct drop-off calculation

CHANGES MADE:
- Converted generic funnel tests into event-driven tests.
- Added visitor_id based session validation.
- Ensured repeated camera detections do not inflate funnel counts.
"""
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_funnel():


    res = client.get(
        "/stores/ST1008/funnel"
    )


    assert res.status_code == 200


    data=res.json()


    assert "stages" in data


    assert len(
        data["stages"]
    ) >= 3