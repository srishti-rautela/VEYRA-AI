# DESIGN.md — System Architecture

# 🟣 VEYRA AI Vision Command Center

## Autonomous Retail Intelligence Platform

VEYRA AI is an end-to-end retail intelligence system that transforms ordinary CCTV footage into meaningful business insights.

Traditional CCTV systems only record what happened.

VEYRA AI understands what happened and converts visual activity into measurable store intelligence.

---

# 1. System Objective

The goal is to convert:

```text
Raw CCTV Footage

        ↓

Computer Vision Understanding

        ↓

Structured Retail Events

        ↓

Real-Time Analytics API

        ↓

Business Decision Dashboard
```

The system focuses on the key retail metric:

**Offline Store Conversion Rate**

Customers who purchased  
÷  
Total unique visitors

---

# 2. High Level Architecture


```text
              CCTV Cameras
                    |
                    |
                    v

        +-----------------------+
        |  Vision AI Pipeline   |
        |  YOLOv8 + Tracking    |
        +-----------------------+

                    |
                    v

        +-----------------------+
        | Visitor Intelligence  |
        | Session Management    |
        +-----------------------+

                    |
                    v

        +-----------------------+
        | Retail Event Engine   |
        +-----------------------+

                    |
                    v

        +-----------------------+
        | FastAPI Backend       |
        +-----------------------+

                    |
                    v

        +-----------------------+
        | React AI Dashboard    |
        +-----------------------+
```

---

# 3. Detection Pipeline Design


## Responsibilities

The vision layer processes CCTV frames and performs:

- Person detection
- Visitor tracking
- Staff filtering
- Queue analysis
- Zone interaction detection


Technology:

- YOLOv8
- Object tracking
- Custom retail logic


Processing:

```text
Video Frame

↓

Person Detection

↓

Tracking ID Assignment

↓

Customer / Staff Classification

↓

Business Event Creation
```

---

# 4. Visitor Session Engine


Problem:

Counting detections directly causes wrong analytics.

Example:

A customer appearing in 200 frames should not count as 200 customers.


Solution:

VEYRA creates anonymous visitor sessions.


Each visitor receives:

```json
{
 "visitor_id":"VIS_102",
 "anonymous":true,
 "session_active":true
}
```


Privacy decisions:

Not used:

- Face recognition
- Biometric identification
- Personal identity storage


Used:

- Movement behaviour
- Zone activity
- Anonymous IDs


---

# 5. Multi Camera Intelligence


The system combines multiple camera viewpoints.


| Camera | Purpose |
|-|-|
| CAM 1 | Complete store understanding |
| CAM 2 | Product zone analytics |
| CAM 3 | Main entrance monitoring |
| CAM 4 | Secondary entrance monitoring |
| CAM 5 | Billing queue intelligence |


This allows:

- Entry counting
- Customer journey analysis
- Queue monitoring
- Store heatmaps


---

# 6. Event Driven Architecture


Raw AI output:

```text
Person detected at coordinate X,Y
```

is transformed into:

```text
Business Event
```


Example:

```json
{
 "event_id":"uuid",
 "store_id":"STORE_BLR_002",
 "visitor_id":"VIS_204",
 "event_type":"ZONE_DWELL",
 "confidence":0.93,
 "is_staff":false
}
```


Supported events:

- ENTRY
- EXIT
- ZONE_ENTER
- ZONE_EXIT
- ZONE_DWELL
- BILLING_QUEUE_JOIN
- REENTRY


Advantages:

- Cleaner analytics
- Better scalability
- Easier debugging

---

# 7. Intelligence API Architecture


Framework:

FastAPI


Reason:

- High performance
- Async support
- Automatic Swagger documentation
- Validation support


Core APIs:


## Event Ingestion

```http
POST /events/ingest
```

Responsibilities:

- Validate events
- Remove duplicates
- Store data


---


## Store Metrics

```http
GET /stores/{id}/metrics
```


Provides:

- Total visitors
- Conversion rate
- Queue status
- Abandonment rate


---


## Funnel Analytics

```http
GET /stores/{id}/funnel
```


Tracks:

Entry

↓

Product Visit

↓

Billing

↓

Purchase


---


## Heatmap

```http
GET /stores/{id}/heatmap
```


Measures:

- Zone popularity
- Average dwell time


---


## Anomaly Detection

```http
GET /stores/{id}/anomalies
```


Detects:

- Queue spikes
- Low conversion
- Dead zones


---

# 8. Business Intelligence Dashboard


The dashboard converts AI output into decisions.


Features:

- Live CCTV intelligence
- Store health score
- Customer journey
- Conversion funnel
- Heatmap analytics
- Staff optimization
- AI recommendations


Goal:

Not just:

"How many people entered?"

But:

"What action should the store take?"

---

# 9. Production Readiness


Implemented:


## Testing

Coverage:

- API tests
- Event tests
- Edge cases
- Analytics validation


Result:

140 automated tests passing


---


## Monitoring

Includes:

- Health endpoint
- System status
- Camera status
- Detection confidence


---


## Deployment

Designed for:

```text
docker compose up
```


Future:

- Kubernetes
- GPU inference services
- Distributed event processing


---

# 10. AI-Assisted Decisions


AI tools were used as engineering assistants during development.

AI did not replace implementation decisions.

All final decisions were reviewed, modified, tested, and validated manually.


---

## Decision 1 — Detection Model


AI helped compare:

- YOLO models
- Transformer detectors
- Vision-language models


Final choice:

YOLOv8


Reason:

- Faster inference
- Lower deployment cost
- Suitable for CCTV streams


---

## Decision 2 — Event Architecture


Options considered:

1. Store raw detections

2. Generate business events


Final decision:

Event-driven architecture


Reason:

Retail managers need insights, not coordinates.


---

## Decision 3 — Backend Architecture


Options reviewed:

- Flask
- FastAPI
- Django


Final decision:

FastAPI


Reason:

- Performance
- API documentation
- Production structure


---

# 11. Scaling Strategy


Current:

Single Store Intelligence


Future:


```text
Multiple Stores

↓

Edge AI Processing

↓

Cloud Event Pipeline

↓

Central Analytics Platform

↓

Enterprise Dashboard
```


Possible upgrades:

- Kafka streaming
- PostgreSQL analytics
- GPU inference
- Kubernetes deployment


---

# Final Vision


VEYRA AI transforms CCTV cameras from passive recording devices into intelligent business assistants.

The system is designed around:

Accuracy

+

Privacy

+

Scalability

+

Business Impact
