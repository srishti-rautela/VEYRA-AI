"""YOLOv8 detection engine. See run.py for full pipeline."""
try:
    from ultralytics import YOLO
    model = YOLO("yolov8s.pt")
except ImportError:
    model = None

def detect_frame(frame):
    if model is None:
        return []
    results = model(frame, classes=[0], conf=0.4)  # class 0 = person
    return results[0].boxes.xyxy.tolist() if results else []
