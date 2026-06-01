# CHOICES.md — Engineering Design Decisions

# 🟣 VEYRA AI Vision Command Center

## Autonomous Retail Intelligence Platform

This document explains architecture choices, technical decisions, trade-offs and scalability considerations.

## 1. Computer Vision Decision

Problem:
Retail CCTV requires real-time detection with multiple people, occlusion and different camera angles.

Compared:
- YOLOv8
- Transformer based detectors
- Traditional computer vision

Selected:

YOLOv8 + Object Tracking

Reasons:
- Real-time performance
- Lightweight deployment
- Strong CCTV compatibility

Pipeline:

CCTV → YOLOv8 → Tracking → Retail Events → Dashboard


## 2. Privacy First Design

VEYRA AI avoids:

- Face recognition
- Biometric tracking
- Personal identification

Uses:

- Anonymous visitor sessions
- Behaviour analytics
- Event intelligence


## 3. Staff vs Customer Intelligence

Problem:

Staff movement should not affect customer analytics.

Solution:

Classify:

CUSTOMER:
- Shopping behaviour
- Product interaction

STAFF:
- Store activity patterns

UNKNOWN:
- Low confidence detections


## 4. Event Architecture

Raw detections are converted into business events.

Example:

{
 "visitor_id":"VIS_101",
 "event":"ZONE_DWELL",
 "confidence":0.93
}

Benefits:

- Scalable
- Analytics friendly
- Business focused


## 5. Backend Decision

Selected FastAPI because:

- High performance APIs
- Async support
- Swagger documentation
- Production structure


## 6. Dashboard Decision

VEYRA provides:

- Store Health Score
- Heatmaps
- Funnel Analytics
- Queue Intelligence
- AI Recommendations


## 7. Testing

Validated:

- APIs
- Event pipeline
- Analytics
- Edge cases

Result:

140 automated tests passing.


## Future Scaling

Edge AI → Cloud APIs → Enterprise Analytics


## Principle

Turn CCTV footage into business decisions.
