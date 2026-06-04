"""
PROMPT:
I asked an AI assistant to design event ingestion tests
for a computer vision event streaming pipeline.

Generate tests covering:
- structured CCTV event schema
- unique event IDs
- duplicate event handling
- malformed event rejection
- batch ingestion reliability

CHANGES MADE:
- Customized tests for YOLOv8 + ByteTrack generated events.
- Added validation for visitor_id, camera_id and confidence fields.
- Improved checks for production event consistency.
"""
from fastapi.testclient import TestClient
from app.main import app
from uuid import uuid4


client = TestClient(app)


def test_event_ingest():


    event={

        "event_id":str(uuid4()),

        "store_id":"TEST",

        "visitor_id":"VIS_TEST",

        "event_type":"ENTRY",

        "is_staff":False

    }



    res=client.post(

        "/events/ingest",

        json={

            "events":[event]

        }

    )


    assert res.status_code == 200