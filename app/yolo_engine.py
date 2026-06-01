from ultralytics import YOLO
import cv2
import time
import threading
import os
import uuid

from datetime import datetime, timezone

from app.database import SessionLocal
from app.models import Event


# -----------------------------
# Load YOLO
# -----------------------------

model = YOLO("yolov8n.pt")


BASE = os.getcwd()


# -----------------------------
# Camera Mapping
# -----------------------------

CAMERAS = {

    "CAM_1_MAIN_VIEW":
        os.path.join(BASE, "data/camera_clips/CAM_1.mp4"),

    "CAM_2_MAIN_SECTION":
        os.path.join(BASE, "data/camera_clips/CAM_2.mp4"),

    "CAM_3_ENTRANCE":
        os.path.join(BASE, "data/camera_clips/CAM_3.mp4"),

    "CAM_4_ENTRANCE":
        os.path.join(BASE, "data/camera_clips/CAM_4.mp4"),

    "CAM_5_BILLING_COUNTER":
        os.path.join(BASE, "data/camera_clips/CAM_5.mp4"),

}


# Dashboard memory

events = []


# Prevent DB flooding

last_saved = {}

SAVE_INTERVAL = 5



# -----------------------------
# Save Event To Database
# -----------------------------

def save_detection_event(
        camera_id,
        visitor_id,
        event_type,
        confidence,
        is_staff=False,
        zone_id=None,
        queue_depth=None
):

    db = SessionLocal()

    try:

        event = Event(

            event_id=str(uuid.uuid4()),

            store_id="STORE_BLR_002",

            camera_id=camera_id,

            visitor_id=str(visitor_id),

            event_type=event_type,

            timestamp=datetime.now(
                timezone.utc
            ).isoformat(),

            zone_id=zone_id,

            dwell_ms=30000
            if event_type == "ZONE_DWELL"
            else 0,

            is_staff=is_staff,

            confidence=float(confidence),

            queue_depth=queue_depth,

            sku_zone=zone_id,

            session_seq=0
        )


        db.add(event)

        db.commit()


    except Exception as e:

        print(
            "EVENT SAVE ERROR:",
            e
        )

        db.rollback()


    finally:

        db.close()



# -----------------------------
# Camera Processing
# -----------------------------

def process_camera(name, path):

    print(
        "Starting:",
        name
    )


    cap = cv2.VideoCapture(path)


    if not cap.isOpened():

        print(
            "VIDEO ERROR:",
            path
        )

        return



    print(
        "CONNECTED:",
        path
    )


    frame_no = 0


    while True:


        ret, frame = cap.read()


        if not ret:

            cap.set(
                cv2.CAP_PROP_POS_FRAMES,
                0
            )

            continue


        frame_no += 1


        result = model(
            frame,
            verbose=False
        )


        people_count = 0



        for r in result:


            for box in r.boxes:


                # person class
                if int(box.cls[0]) == 0:


                    people_count += 1


                    confidence = float(
                        box.conf[0]
                    )


                    visitor_id = (
                        name
                        + "_VIS_"
                        + str(int(box.xyxy[0][0]))
                    )



                    # -----------------------
                    # Event decision
                    # -----------------------


                    if "ENTRANCE" in name:

                        event_type = "ENTRY"

                        zone = "ENTRANCE"


                    elif "BILLING" in name:

                        event_type = (
                            "BILLING_QUEUE_JOIN"
                        )

                        zone = "BILLING_QUEUE"


                    else:

                        event_type = (
                            "ZONE_DWELL"
                        )

                        zone = "SHOP_FLOOR"



                    key = (
                        visitor_id,
                        event_type
                    )



                    now = time.time()



                    if (
                        key not in last_saved
                        or
                        now-last_saved[key]
                        > SAVE_INTERVAL
                    ):


                        save_detection_event(

                            camera_id=name,

                            visitor_id=visitor_id,

                            event_type=event_type,

                            confidence=confidence,

                            is_staff=False,

                            zone_id=zone,

                            queue_depth=
                            people_count
                            if "BILLING" in name
                            else None

                        )


                        last_saved[key] = now



        data = {

            "camera": name,

            "people": people_count,

            "time": time.time()

        }


        print(data)


        events.append(data)


        if len(events) > 100:

            events.pop(0)


        time.sleep(1)




# -----------------------------
# Start Engine
# -----------------------------

def start_yolo():


    print(
        "YOLO ENGINE STARTED"
    )


    for name, path in CAMERAS.items():


        threading.Thread(

            target=process_camera,

            args=(name, path),

            daemon=True

        ).start()



# -----------------------------
# Dashboard API
# -----------------------------

def get_live_events():

    return events[-20:]