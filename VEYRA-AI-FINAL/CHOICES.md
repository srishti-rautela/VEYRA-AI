# 🧠 VEYRA AI — Engineering Choices & Tradeoffs

<div align="center">

## Vision Enabled Yield & Retail Analytics

### Why each technical decision was made

`Computer Vision` • `Event Architecture` • `API Design` • `Production Thinking`

</div>

---

# 1. Engineering Philosophy

VEYRA AI was designed with one goal:

> Convert raw CCTV footage into reliable business intelligence.

The architecture prioritizes:

✅ Accuracy
✅ Real-time performance
✅ Privacy awareness
✅ Scalability
✅ Maintainability

Core principle:

```text
Do not store more data.
Extract more intelligence.
```

---

# 2. Model Selection Decision

## Selected Model: YOLOv8

Alternatives considered:

* Faster R-CNN
* SSD based detectors
* Traditional OpenCV approaches

## Why YOLOv8?

| Requirement              | Reason                         |
| ------------------------ | ------------------------------ |
| Real-time CCTV analytics | High inference speed           |
| Person detection         | Strong accuracy                |
| Deployment               | Lightweight variants available |
| Community support        | Mature ecosystem               |

Processing:

```text
Camera Frame

      ↓

YOLOv8 Detection

      ↓

Person Bounding Boxes

      ↓

Tracking Pipeline
```

## Tradeoff

Two-stage detectors can provide higher accuracy in some cases.

However:

```text
Retail Analytics Requirement

Speed + Accuracy Balance

        ↓

YOLOv8 Selected
```

---

# 3. Tracking Choice

## Selected: ByteTrack

Problem:

Detection alone creates duplicate counts.

Example:

Without tracking:

```text
Frame 1 → Person A

Frame 2 → Person A

Count = 2 ❌
```

With tracking:

```text
Frame 1 → Visitor VIS_01

Frame 2 → Visitor VIS_01

Count = 1 ✅
```

Chosen because:

* Handles short occlusions
* Real-time capable
* Works well with detection pipelines
* Lightweight

---

# 4. Event Schema Design

VEYRA follows an event-first architecture.

Instead of storing videos:

```text
Raw Video ❌

Meaningful Events ✅
```

Example JSONL event:

```json
{
 "event_id":"evt_001",

 "store_id":"ST1008",

 "visitor_id":"VIS_001",

 "camera_id":"s1c1",

 "event_type":"zone_entered",

 "timestamp":"2026-06-04T11:00:00Z",

 "zone_id":"Z_ENTRY",

 "dwell_ms":45000,

 "is_staff":false
}
```

## Why JSONL?

Selected because:

| Requirement          | Benefit                    |
| -------------------- | -------------------------- |
| Large event streams  | Line-by-line processing    |
| Debugging            | Human readable             |
| Replay analytics     | Append-only logs           |
| Challenge evaluation | Schema validation friendly |

---

# 5. Staff Exclusion Decision

Problem:

Retail cameras detect:

* Customers
* Employees

Counting staff affects:

* Footfall
* Conversion
* Queue metrics

Solution:

Each event contains:

```json
{
 "is_staff": true
}
```

Analytics engines filter staff activity where customer-only metrics are required.

---

# 6. Re-entry Handling Decision

Challenge:

A visitor can:

* Leave camera view
* Return later
* Move between cameras

Solution:

Visitor sessions maintain:

* visitor_id
* timestamps
* camera events
* zone history

This allows:

✔ Duplicate reduction
✔ Journey reconstruction
✔ Better conversion analysis

---

# 7. API Architecture Decision

Framework selected:

# FastAPI

Alternatives:

* Flask
* Django

Why FastAPI:

| Requirement    | Benefit           |
| -------------- | ----------------- |
| Analytics APIs | REST support      |
| Live dashboard | WebSocket support |
| Performance    | Async execution   |
| Documentation  | Automatic OpenAPI |

---

# 8. API Design

Endpoints are separated by responsibility.

```text
/stores/{id}/metrics

        ↓
Business KPIs


/stores/{id}/heatmap

        ↓
Zone Intelligence


/stores/{id}/funnel

        ↓
Customer Conversion


/stores/{id}/ai-manager

        ↓
Recommendations


/stores/{id}/report

        ↓
Executive Summary
```

Benefits:

* Easy testing
* Independent modules
* Frontend flexibility

---

# 9. Frontend Choice

Selected:

React + TypeScript

Reasons:

React:

* Component-based dashboard
* Real-time UI updates
* Reusable visual modules

TypeScript:

* Type safety
* Better maintainability

---

# 10. Storage Decision

Current prototype:

```text
Event Memory Store

+
JSONL Export
```

Benefits:

* Fast access
* Simple evaluation
* Easy replay

Production migration:

```text
Kafka

 ↓

Database

 ↓

Analytics Warehouse
```

---

# 11. Deployment Choice

Selected:

Docker

Reason:

```text
Same environment

Developer Machine

        ↓

Cloud Server
```

Benefits:

✔ Dependency isolation
✔ Easy setup
✔ Production friendly

---

# 12. AI-Assisted Engineering Decisions

AI tools assisted during:

* Architecture brainstorming
* Debugging approaches
* Documentation organization
* Code review suggestions

All final decisions were:

✔ Manually reviewed
✔ Tested
✔ Adapted to project requirements

---

# 13. Future Engineering Improvements

Planned:

* Kafka event streaming
* GPU edge inference
* Persistent database storage
* Advanced appearance-based ReID
* Predictive analytics models

---

<div align="center">

# VEYRA AI

## From Detection → Understanding → Decisions 🚀

</div>
