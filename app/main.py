"""
main.py — FastAPI application entrypoint.

Production features:
  - Structured JSON logging with trace_id, latency, event_count
  - Graceful DB error handling (503 with structured body, no stack traces)
  - Idempotent event ingestion
  - CORS enabled for dashboard access
  - Request ID propagation
  - HTTP range-request video streaming for CCTV camera feeds
"""

import os
import json
import time
import uuid
import logging
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from app.yolo_engine import (
    start_yolo,
    get_live_events
)

from threading import Thread

from app.database import get_db, init_db, check_db_health
from app.models import (
    IngestBatch, IngestResponse, StoreMetrics,
    FunnelResponse, HeatmapResponse, AnomaliesResponse, HealthResponse,
    EventIn,
)
from app.ingestion import ingest_events, ingest_pos_transactions
from app.metrics import get_store_metrics
from app.funnel import get_store_funnel
from app.anomalies import get_store_anomalies
from app.health import get_health
from app.heatmap import get_store_heatmap
from app.dashboard import router as dashboard_router, broadcast_update
from uuid import uuid4
from datetime import datetime
_LOCAL_VIDEO_DIR = Path(os.getenv("VIDEO_DIR", "../CCTV Footage"))
_BUNDLED_CLIPS_DIR = Path("data/camera_clips")

CAMERA_REGISTRY_MAP = {
    # Main whole store footage
    "CAM_1": ("CAM_1.mp4", "CAM_1.mp4"),

    # Main product section
    "CAM_2": ("CAM_2.mp4", "CAM_2.mp4"),

    # Entrance camera 1
    "CAM_3": ("CAM_3.mp4", "CAM_3.mp4"),

    # Entrance camera 2
    "CAM_4": ("CAM_4.mp4", "CAM_4.mp4"),

    # Billing counter
    "CAM_5": ("CAM_5.mp4", "CAM_5.mp4"),
}

def _resolve_video_path(cam_id: str):
    entry = CAMERA_REGISTRY_MAP.get(cam_id.upper())
    if not entry:
        return None
    local_name, bundled_name = entry
    local_path = _LOCAL_VIDEO_DIR / local_name
    if local_path.exists():
        return local_path
    bundled_path = _BUNDLED_CLIPS_DIR / bundled_name
    if bundled_path.exists():
        return bundled_path
    return None

VIDEO_DIR = _LOCAL_VIDEO_DIR
CAMERA_REGISTRY = {k: v[0] for k, v in CAMERA_REGISTRY_MAP.items()}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_dict = {
            "time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "trace_id"):
            log_dict["trace_id"] = record.trace_id
        if hasattr(record, "store_id"):
            log_dict["store_id"] = record.store_id
        if hasattr(record, "endpoint"):
            log_dict["endpoint"] = record.endpoint
        if hasattr(record, "latency_ms"):
            log_dict["latency_ms"] = record.latency_ms
        if hasattr(record, "status_code"):
            log_dict["status_code"] = record.status_code
        if hasattr(record, "event_count"):
            log_dict["event_count"] = record.event_count
        return json.dumps(log_dict)


def setup_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(logging.INFO)


setup_logging()
log = logging.getLogger("VEYRA AI.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting VEYRA AI Retail Intelligence API...")

    init_db()

    try:
        Thread(
            target=start_yolo,
            daemon=True
        ).start()
        log.info("YOLO CCTV Engine started successfully")
    except Exception as e:
        log.error(f"YOLO Engine failed: {e}")

    pos_path_env = os.getenv("POS_CSV_PATH")
    from app.database import get_db_context
    with get_db_context() as db:
        data_dir = "data"
        if os.path.exists(data_dir):
            for filename in os.listdir(data_dir):
                if filename.endswith(".csv"):
                    csv_path = os.path.join(data_dir, filename)
                    log.info(f"Ingesting POS transactions from {csv_path}...")
                    ingest_pos_transactions(csv_path, db)

        if pos_path_env and os.path.exists(pos_path_env):
            abs_pos_env = os.path.abspath(pos_path_env)
            abs_data_dir = os.path.abspath(data_dir)
            if not abs_pos_env.startswith(abs_data_dir):
                log.info(f"Ingesting extra POS transactions from env path: {pos_path_env}...")
                ingest_pos_transactions(pos_path_env, db)

    log.info("API ready.")
    yield
    log.info("Shutting down.")


app = FastAPI(
    title="VEYRA AI Retail Store Intelligence API",
    description="Real-time store analytics from CCTV detection pipeline",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router)


import asyncio
import httpx
from app.models import Event

class SimulationManager:
    def __init__(self):
        self._task = None
        self.speed = 1.0
        self.selected_cam = "CAM_1"

    def stop(self):
        if self._task and not self._task.done():
            self._task.cancel()

    def start(self, speed: float, selected_cam: str):
        self.stop()
        self.speed = speed
        self.selected_cam = selected_cam
        self._task = asyncio.create_task(self._run())

    def set_speed(self, speed: float):
        self.speed = speed
        asyncio.create_task(self._sync_yolo_speed(speed))

    async def _sync_yolo_speed(self, speed: float):
        try:
            async with httpx.AsyncClient() as client:
                await client.post(f"http://127.0.0.1:8001/speed/{speed}", timeout=2.0)
            log.info(f"YOLO stream server speed updated to {speed}x.")
        except Exception as e:
            log.warning(f"Failed to sync YOLO stream speed: {e}")

    async def _run(self):
        try:
            from app.database import get_db_context
            with get_db_context() as db:
                db.query(Event).delete()
            await broadcast_update({
                "type": "reset",
                "store_id": "ALL",
                "data": None
            })
            log.info("Simulation cleared database and broadcasted reset.")
        except Exception as e:
            log.error(f"Failed to clear database events for simulation: {e}")
            return

        try:
            async with httpx.AsyncClient() as client:
                await client.post(f"http://127.0.0.1:8001/switch/{self.selected_cam}", timeout=2.0)
                await client.post(f"http://127.0.0.1:8001/speed/{self.speed}", timeout=2.0)
        except Exception as e:
            log.warning(f"Failed to sync YOLO stream server for simulation: {e}")

        events_path = Path("data/events.jsonl")
        if not events_path.exists():
            log.error(f"events.jsonl not found at {events_path}")
            return

        events = []
        with open(events_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    events.append(json.loads(line))

        if not events:
            log.error("No events found in events.jsonl")
            return

        events.sort(key=lambda e: e.get("timestamp", ""))

        first_ts = datetime.fromisoformat(events[0]["timestamp"].replace("Z", "+00:00"))
        prev_event_ts = first_ts

        log.info(f"Starting synchronized simulation of {len(events)} events starting at {self.speed}x speed")
        for event in events:
            try:
                event_ts = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
                delta_clip_s = (event_ts - prev_event_ts).total_seconds()

                if delta_clip_s > 0:
                    await asyncio.sleep(delta_clip_s / self.speed)

                prev_event_ts = event_ts

                from app.database import get_db_context
                from app.ingestion import ingest_events
                from app.models import EventIn
                from app.metrics import get_store_metrics

                with get_db_context() as db:
                    ev_in = EventIn(**event)
                    ingest_events([ev_in], db)

                    store_id = event["store_id"]
                    metrics = get_store_metrics(store_id, db)
                    await broadcast_update({
                        "type": "metrics",
                        "store_id": store_id,
                        "data": metrics.model_dump(),
                    })
            except asyncio.CancelledError:
                log.info("Simulation cancelled.")
                break
            except Exception as e:
                log.error(f"Error in simulation loop: {e}")
                await asyncio.sleep(0.1)

        log.info("Simulation complete.")

sim_manager = SimulationManager()


@app.post("/simulation/start", tags=["simulation"])
async def start_simulation(speed: float = 1.0, cam_id: str = "CAM_1"):
    sim_manager.start(speed, cam_id)
    return {"ok": True, "message": f"Simulation started at {speed}x speed on {cam_id}."}


@app.post("/simulation/speed", tags=["simulation"])
async def change_simulation_speed(speed: float = 1.0):
    sim_manager.set_speed(speed)
    return {"ok": True, "message": f"Simulation speed changed to {speed}x."}


@app.post("/simulation/stop", tags=["simulation"])
async def stop_simulation():
    sim_manager.stop()
    return {"ok": True, "message": "Simulation stopped."}


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    trace_id = str(uuid.uuid4())[:8]
    request.state.trace_id = trace_id
    start = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception as e:
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        extra = {
            "trace_id": trace_id,
            "endpoint": str(request.url.path),
            "latency_ms": latency_ms,
            "status_code": 500,
        }
        log.error(f"Unhandled exception: {e}", extra=extra)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "trace_id": trace_id},
        )

    latency_ms = round((time.perf_counter() - start) * 1000, 1)
    extra = {
        "trace_id": trace_id,
        "endpoint": str(request.url.path),
        "latency_ms": latency_ms,
        "status_code": response.status_code,
    }
    log.info(f"{request.method} {request.url.path}", extra=extra)
    response.headers["X-Trace-Id"] = trace_id
    return response


def db_guard(db: Session):
    if not check_db_health():
        raise HTTPException(
            status_code=503,
            detail={
                "error": "DATABASE_UNAVAILABLE",
                "message": "Database is temporarily unavailable. Please try again.",
            },
        )


@app.get("/", tags=["meta"])
async def root():
    return {
        "service": "VEYRA AI Retail Store Intelligence API",
        "version": "1.0.0",
        "docs": "/docs",
        "dashboard": "/dashboard",
        "health": "/health",
    }


@app.get("/config", tags=["meta"])
async def get_config(request: Request):
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    api_url = f"{scheme}://{host}".rstrip("/")
    return {"api_url": api_url}


@app.post("/events/ingest", response_model=IngestResponse, tags=["ingestion"])
async def ingest(
    request: Request,
    batch: IngestBatch,
    db: Session = Depends(get_db),
):
    db_guard(db)

    trace_id = getattr(request.state, "trace_id", "unknown")
    n = len(batch.events)

    result = ingest_events(batch.events, db)

    extra = {
        "trace_id": trace_id,
        "event_count": n,
        "endpoint": "/events/ingest",
        "status_code": 200,
    }
    log.info(f"Ingested batch: {result.accepted} accepted, {result.rejected} rejected, {result.duplicate} duplicates", extra=extra)

    store_ids = set(ev.store_id for ev in batch.events)
    for store_id in store_ids:
        try:
            metrics = get_store_metrics(store_id, db)
            await broadcast_update({
                "type": "metrics",
                "store_id": store_id,
                "data": metrics.model_dump(),
            })
        except Exception as e:
            log.warning(f"Failed to broadcast update for {store_id}: {e}")

    return result


@app.post("/events/clear", tags=["ingestion"])
async def clear_events(db: Session = Depends(get_db)):
    db_guard(db)
    try:
        from app.models import Event
        db.query(Event).delete()
        db.commit()
        await broadcast_update({
            "type": "reset",
            "store_id": "ALL",
            "data": None
        })
        return {"ok": True, "message": "All events cleared successfully."}
    except Exception as e:
        db.rollback()
        log.error(f"Failed to clear events: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stores/{store_id}/metrics", response_model=StoreMetrics, tags=["analytics"])
async def store_metrics(
    store_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    db_guard(db)
    extra = {"trace_id": getattr(request.state, "trace_id", ""), "store_id": store_id, "endpoint": f"/stores/{store_id}/metrics"}
    log.info(f"Fetching metrics for {store_id}", extra=extra)
    return get_store_metrics(store_id, db)


@app.get("/metrics", response_model=StoreMetrics, tags=["analytics"])
@app.get("/Metrics", response_model=StoreMetrics, tags=["analytics"])
async def global_metrics(
    request: Request,
    store_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    db_guard(db)
    if not store_id:
        from app.models import Event
        first_store = db.query(Event.store_id).first()
        if first_store:
            store_id = first_store[0]
        else:
            store_id = "STORE_BLR_002"

    extra = {"trace_id": getattr(request.state, "trace_id", ""), "store_id": store_id, "endpoint": "/metrics"}
    log.info(f"Fetching global metrics alias for {store_id}", extra=extra)
    return get_store_metrics(store_id, db)


@app.get("/stores/{store_id}/funnel", response_model=FunnelResponse, tags=["analytics"])
async def store_funnel(
    store_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    db_guard(db)
    return get_store_funnel(store_id, db)


@app.get("/stores/{store_id}/heatmap", response_model=HeatmapResponse, tags=["analytics"])
async def store_heatmap(
    store_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    db_guard(db)
    return get_store_heatmap(store_id, db)


@app.get("/stores/{store_id}/anomalies", response_model=AnomaliesResponse, tags=["analytics"])
async def store_anomalies(
    store_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    db_guard(db)
    return get_store_anomalies(store_id, db)


@app.get("/health", response_model=HealthResponse, tags=["ops"])
async def health(db: Session = Depends(get_db)):
    return get_health(db)


@app.get("/cameras", tags=["video"])
async def list_cameras():
    cameras = []
    for cam_id, filename in CAMERA_REGISTRY.items():
        cameras.append({
            "cam_id": cam_id,
            "name": filename.replace(".mp4", ""),
            "filename": filename,
            "available": True,
            "stream_url": f"/cameras/stream/{cam_id}",
        })
    return {"cameras": cameras}


@app.get("/video/{cam_id}", tags=["video"])
async def stream_video(cam_id: str, request: Request):
    video_path = _resolve_video_path(cam_id)
    if not video_path:
        raise HTTPException(
            status_code=404,
            detail=f"Camera '{cam_id}' not found. Available: {list(CAMERA_REGISTRY_MAP.keys())}"
        )

    file_size = video_path.stat().st_size
    range_header = request.headers.get("range")
    CHUNK = 1024 * 1024

    if range_header:
        range_val = range_header.strip().lower().replace("bytes=", "")
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else min(start + CHUNK - 1, file_size - 1)
        end = min(end, file_size - 1)
        content_length = end - start + 1

        def iter_range():
            with open(video_path, "rb") as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    data = f.read(min(CHUNK, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
        }
        return StreamingResponse(iter_range(), status_code=206, headers=headers, media_type="video/mp4")

    else:
        def iter_full():
            with open(video_path, "rb") as f:
                while chunk := f.read(CHUNK):
                    yield chunk

        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        }
        return StreamingResponse(iter_full(), status_code=200, headers=headers, media_type="video/mp4")


CAM_TO_LAYOUT_KEY = {
    "CAM_1": "CAM_FLOOR_MAIN",
    "CAM_2": "CAM_FLOOR_PRODUCT",
    "CAM_3": "CAM_ENTRY_01",
    "CAM_4": "CAM_ENTRY_02",
    "CAM_5": "CAM_BILLING_01",
}

def get_zones_for_cam(cam_id: str) -> dict:
    layout_key = CAM_TO_LAYOUT_KEY.get(cam_id.upper())
    if not layout_key:
        return {}
    try:
        with open("data/store_layout.json", "r") as f:
            layout = json.load(f)
        for store in layout["stores"].values():
            if layout_key in store["cameras"]:
                return store["cameras"][layout_key]
    except Exception:
        pass
    return {}

yolo_stats = {}

yolo_model = None

_track_roles: dict = {}

ENTRY_CAMS = {"CAM_3", "CAM_4"}

def get_yolo_model():
    global yolo_model
    if yolo_model is None:
        try:
            from ultralytics import YOLO
            yolo_model = YOLO("yolov8n.pt")
        except Exception as e:
            logging.getLogger("app.main").warning(f"Failed to load YOLO model: {e}")
    return yolo_model


def _classify_person(
    x1: int, y1: int, x2: int, y2: int,
    cam_id: str,
    track_id,
    frame_w: int,
    frame_h: int,
    frame=None,
) -> str:

    if track_id is not None and track_id in _track_roles:
        return _track_roles[track_id]

    width = x2 - x1
    height = y2 - y1

    if width < 25 or height < 60:
        role = "UNKNOWN"
    else:
        role = "CUSTOMER"

    if frame is not None and role != "UNKNOWN":
        crop = frame[max(0, y1):y2, max(0, x1):x2]

        if crop.size > 0:
            ch, cw, _ = crop.shape

            upper_body = crop[int(ch * 0.15):int(ch * 0.65), :]

            brightness = upper_body.mean()

            # Bag heuristic: bags usually make silhouette wider
            body_ratio = width / max(height, 1)
            bag_detected = body_ratio > 0.45

            # Demo store rule:
            # dark uniform + no visible bag => STAFF
            if brightness < 80 and not bag_detected:
                role = "STAFF"
            else:
                role = "CUSTOMER"

    # Entrance cameras are visitor entry cameras
    if cam_id.upper() in ["CAM_3", "CAM_4"] and role != "UNKNOWN":
        role = "CUSTOMER"

    if track_id is not None:
        _track_roles[track_id] = role

    return role


async def generate_mjpeg_stream(cam_id: str):
    import asyncio
    import numpy as np
    import cv2

    cam_info = get_zones_for_cam(cam_id)
    zones = cam_info.get("zones", {})
    entry_line_y = cam_info.get("entry_line_y_ratio")
    cam_type = cam_info.get("type", "unknown")

    video_path = _resolve_video_path(cam_id)
    cap = None

    if video_path:
        cap = cv2.VideoCapture(str(video_path))

    frame_no = 0
    fps = 20.0

    if cap and cap.isOpened():
        real_fps = cap.get(cv2.CAP_PROP_FPS)
        if real_fps > 0:
            fps = min(real_fps, 30)

    prev_detections = []

    try:
        while True:
            frame_no += 1
            h, w = 480, 640
            frame = None

            if cap:
                ret, raw = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, raw = cap.read()
                if ret:
                    frame = cv2.resize(raw, (w, h))

            if frame is None:
                frame = np.zeros((h, w, 3), dtype=np.uint8)

            if frame_no % 3 == 0 or not prev_detections:
                model = get_yolo_model()
                detections = []

                if model:
                    try:
                        results = model.track(
                            frame,
                            persist=True,
                            classes=[0],
                            conf=0.25,
                            verbose=False
                        )

                        if results:
                            boxes = results[0].boxes
                            if boxes:
                                for box in boxes:
                                    track_id = None
                                    if box.id is not None:
                                        track_id = int(box.id[0])
                                    detections.append({
                                        "xyxy": box.xyxy[0].tolist(),
                                        "conf": float(box.conf[0]),
                                        "track_id": track_id,
                                    })

                        prev_detections = detections

                    except Exception:
                        pass
            else:
                detections = prev_detections

            overlay = frame.copy()

            for zone_name, zone in zones.items():
                poly = zone.get("polygon", [])
                if not poly:
                    continue

                pts = np.array(
                    [[int(x * w), int(y * h)] for x, y in poly],
                    np.int32
                )

                color = (0, 180, 120)

                if "BILLING" in zone_name:
                    color = (255, 120, 0)
                elif "ENTRY" in zone_name:
                    color = (0, 255, 0)

                cv2.fillPoly(overlay, [pts], color)
                cv2.polylines(overlay, [pts], True, color, 2)

            cv2.addWeighted(overlay, 0.15, frame, 0.85, 0, frame)

            for det in detections:
                x1, y1, x2, y2 = map(int, det["xyxy"])
                conf = det["conf"]
                track_id = det.get("track_id")

                if conf < 0.35:
                    role = "UNKNOWN"
                else:
                    role = _classify_person(x1, y1, x2, y2, cam_id, track_id, w, h, frame)

                if role == "CUSTOMER":
                    color = (0, 255, 0)
                elif role == "STAFF":
                    color = (255, 120, 0)
                else:
                    color = (160, 160, 160)

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.rectangle(frame, (x1, y1 - 22), (x1 + 120, y1), color, -1)
                cv2.putText(
                    frame,
                    role,
                    (x1 + 5, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (0, 0, 0),
                    1
                )

            if entry_line_y is not None and cam_id in ["CAM_3", "CAM_4"]:
                y = int(entry_line_y * h)
                cv2.line(frame, (0, y), (w, y), (0, 255, 200), 2)
                cv2.putText(
                    frame,
                    "ENTRY LINE",
                    (10, y - 8),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 200),
                    1
                )

            cv2.putText(
                frame,
                f"{cam_id} [{cam_type}]",
                (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 200),
                2
            )

            people = len(detections)

            cv2.putText(
                frame,
                f"YOLO: {people}",
                (10, 460),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )

            yolo_stats[cam_id.upper()] = {
                "people": people,
                "frame": frame_no,
                "fps": fps
            }

            _, jpg = cv2.imencode(".jpg", frame)

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + jpg.tobytes()
                + b"\r\n"
            )

            await asyncio.sleep(1 / fps)

    except asyncio.CancelledError:
        pass

    finally:
        if cap:
            cap.release()


@app.get("/cameras/stream/{cam_id}", tags=["video"])
async def stream_camera(cam_id: str):
    return StreamingResponse(
        generate_mjpeg_stream(cam_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.get("/cameras/stats/{cam_id}", tags=["video"])
async def get_camera_stats(cam_id: str):
    return yolo_stats.get(cam_id.upper(), {"people": 0, "frame": 0, "fps": 0.0})


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_config=None,
    )


from app.ai_engine import router as ai_router
app.include_router(ai_router)


@app.get("/camera/events")
def camera_events():
    return get_live_events()

LIVE_EVENTS=[]

@app.get("/events/live")
def live_ai_events():
    try:
        yolo_events = get_live_events()
        if yolo_events:
            return {"events": yolo_events[-50:]}
    except Exception:
        pass
    return {"events": LIVE_EVENTS[-50:]}
# =====================================================
# Challenge Compatible API Routes
# =====================================================


@app.get("/stores/{store_id}/metrics")
def challenge_metrics(store_id: str):

    return get_metrics()



@app.get("/stores/{store_id}/funnel")
def challenge_funnel(store_id: str):

    return get_funnel()



@app.get("/stores/{store_id}/heatmap")
def challenge_heatmap(store_id: str):

    return get_heatmap()



@app.get("/stores/{store_id}/anomalies")
def challenge_anomalies(store_id: str):

    return get_anomalies()