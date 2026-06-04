"""
VEYRA AI — YOLOv8 + ByteTrack Retail Vision Engine
==================================================

Pipeline:
CCTV Video
    ↓
YOLOv8 Person Detection
    ↓
ByteTrack Tracking
    ↓
Staff / Customer Classification
    ↓
Zone Analytics JSON

Run:
python run_inference.py
"""


import cv2
import json
import numpy as np
from pathlib import Path
from ultralytics import YOLO
from session_manager import SessionManager

from staff_classifier import classify_person

from reid import get_reid

from emit import create_event



# ============================================================
# CONFIG
# ============================================================


PUBLIC_DIR = Path("../frontend/public")


OUT_DIR = PUBLIC_DIR / "detections"

OUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)



# CCTV optimized
FRAME_SKIP = 3


MODEL_NAME = "yolov8n.pt"



VIDEOS = [


    {
        "file":"store1_cam1_entry.mp4",
        "store":"ST1008",
        "cam":"s1c1",
        "staff_color":"black"
    },


    {
        "file":"store1_cam2_zone.mp4",
        "store":"ST1008",
        "cam":"s1c2",
        "staff_color":"black"
    },


    {
        "file":"store1_cam3_zone.mp4",
        "store":"ST1008",
        "cam":"s1c3",
        "staff_color":"black"
    },


    {
        "file":"store1_cam5_billing.mp4",
        "store":"ST1008",
        "cam":"s1c5",
        "staff_color":"black"
    },



    {
        "file":"store2_cam1_entry.mp4",
        "store":"ST1076",
        "cam":"s2c1",
        "staff_color":"pink"
    },


    {
        "file":"store2_cam_zone.mp4",
        "store":"ST1076",
        "cam":"s2c2",
        "staff_color":"pink"
    },


    {
        "file":"store2_cam3_display.mp4",
        "store":"ST1076",
        "cam":"s2c3",
        "staff_color":"pink"
    },


    {
        "file":"store2_cam_billing.mp4",
        "store":"ST1076",
        "cam":"s2c4",
        "staff_color":"pink"
    }

]





# ============================================================
# STAFF COLOR DETECTOR
# ============================================================


def detect_staff_color(frame, box):


    x1,y1,x2,y2 = map(
        int,
        box
    )


    h = y2-y1


    crop = frame[

        y1:y1+int(h*0.55),

        x1:x2

    ]



    if crop.size == 0:

        return "other"



    hsv = cv2.cvtColor(

        crop,

        cv2.COLOR_BGR2HSV

    )



    pixels = hsv.reshape(
        -1,
        3
    )



    black_ratio = (

        pixels[:,2] < 60

    ).mean()



    pink_ratio = (

        (pixels[:,0] > 140)

        &

        (pixels[:,0] < 175)

        &

        (pixels[:,1] > 50)

    ).mean()



    if black_ratio > 0.45:

        return "black"



    if pink_ratio > 0.35:

        return "pink"



    return "other"





# ============================================================
# SIMPLE GENDER CLASSIFIER
# ============================================================


def estimate_gender(box):


    x1,y1,x2,y2 = box


    width = x2-x1

    height = y2-y1



    if height <= 0:

        return "F"



    ratio = width / height



    if ratio < 0.32:

        return "M"



    return "F"






# ============================================================
# STORE ZONE MAPPING
# ============================================================


ZONE_MAP = {


"s1c1":

[
"Entry Gate",
"Entry Line 1",
"Entry Line 2",
"Welcome Area"
],



"s1c2":

[
"Fragrance",
"F.O.H Makeup",
"Salm",
"TFS"
],




"s1c3":

[
"Minimalis",
"Aqualogi",
"Foxtale",
"JC"
],




"s1c5":

[
"Billing Counter",
"Billing Queue",
"Checkout",
"Payment"
],




"s2c1":

[
"Entry",
"Entry Line 1",
"Entry Line 2",
"Welcome"
],




"s2c2":

[
"Left Shelf",
"Skincare",
"Fragrance",
"Display"
],




"s2c3":

[
"Back Shelf",
"Nail Bar",
"Beauty Zone",
"Display"
],




"s2c4":

[
"Billing Counter",
"Billing Queue",
"Checkout",
"Payment"
]


}





def get_zone(cam, x_percent):


    zones = ZONE_MAP.get(

        cam,

        ["Floor"]

    )



    index = min(

        int(
            x_percent *
            len(zones)
        ),

        len(zones)-1

    )


    return zones[index]






# ============================================================
# PROCESS SINGLE VIDEO
# ============================================================



def process_video(cfg, model):


    video_path = PUBLIC_DIR / cfg["file"]



    if not video_path.exists():

        print(
            "❌ Missing:",
            video_path
        )

        return




    cap = cv2.VideoCapture(
        str(video_path)
    )



    fps = (

        cap.get(
            cv2.CAP_PROP_FPS
        )

        or

        30

    )




    print(
f"""

====================================
🎥 Processing Camera

Store   : {cfg['store']}
Camera  : {cfg['cam']}
Video   : {cfg['file']}

YOLO    : ACTIVE
Tracker : ByteTrack
====================================

"""
    )



    frames_out = []

    events = []

    session_manager = SessionManager()

    frame_no = 0

    fallback_id = 10000




    while True:


        ret, frame = cap.read()



        if not ret:

            break



        if frame_no % FRAME_SKIP != 0:

            frame_no += 1

            continue





        H,W = frame.shape[:2]




        results = model.track(

            frame,

            persist=True,

            classes=[0],

            conf=0.40,

            iou=0.45,

            tracker="bytetrack.yaml",

            verbose=False

        )





        detections=[]





        for r in results:


            for box in r.boxes:




                x1,y1,x2,y2 = (

                    box.xyxy[0]
                    .tolist()

                )




                cx = (

                    (x1+x2)/2

                ) / W




                cy = (

                    (y1+y2)/2

                ) / H


                color_found = detect_staff_color(

                    frame,

                    (x1,y1,x2,y2)

                )



                # ===================================
                # STAFF CLASSIFICATION
                # ===================================

                is_staff = (
                    color_found == cfg["staff_color"]
                )


                # Billing camera business rule
                # Staff stays behind billing counter

                if cfg["cam"] in ["s1c5", "s2c4"]:

                    if cy < 0.75:

                        is_staff = True




                gender = estimate_gender(

                    (x1,y1,x2,y2)

                )



                if is_staff:

                    gender = None



                if box.id is not None:


                    track_id = int(

                        box.id[0]

                    )



                else:


                    fallback_id += 1

                    track_id = fallback_id






                label = (


                    "Staff"


                    if is_staff


                    else


                    (

                    "Customer-F"


                    if gender=="F"


                    else


                    "Customer-M"


                    )

                )






                section = get_zone(cfg["cam"], cx)

                visitor_id, is_new = get_reid(
                    track_id,
                    [x1, y1, x2, y2]
                )

                session = session_manager.update(
                    visitor_id,
                    section
                )

                smart_staff = classify_person(
                    visitor_id,
                    section
                )

                is_staff = is_staff or smart_staff

                event_type = "ENTRY" if is_new else "ZONE_DWELL"

                events.append(
                    create_event(
                        cfg["store"],
                        cfg["cam"],
                        visitor_id,
                        event_type,
                        section,
                        session["dwell_ms"],
                        float(box.conf[0]),
                        is_staff,
                        {
                            "track_id": track_id,
                            "path": session["path"]
                        }
                    )
                )



                detections.append({



                    "id":

                    f"{cfg['cam']}_P{track_id}",



                    "track_id":

                    track_id,



                    "frame":

                    frame_no,



                    "timestamp_s":

                    round(

                        frame_no/fps,

                        3

                    ),




                    "x":

                    round(

                        cx*100,

                        1

                    ),




                    "y":

                    round(

                        cy*100,

                        1

                    ),





                    "box":

                    [

                    round(x1),

                    round(y1),

                    round(x2),

                    round(y2)

                    ],




                    "confidence":

                    round(

                        float(box.conf[0]),

                        3

                    ),




                    "label":

                    label,



                    "gender":

                    gender,




                    "is_staff":

                    is_staff,





                    "section":

                    section,





                    "store_id":

                    cfg["store"],





                    "cam_id":

                    cfg["cam"],






                    "color":


                    "#38c4ff"

                    if is_staff


                    else


                    (

                    "#ff4fa3"

                    if gender=="F"


                    else


                    "#00e5a0"

                    )

                })





        frames_out.append({


            "frame":

            frame_no,


            "detections":

            detections

        })



        frame_no += 1





    cap.release()





    output_file = OUT_DIR / (

        video_path.stem + ".json"

    )




    with open(

        output_file,

        "w"

    ) as f:


        json.dump(

            {

            "cam_id":

            cfg["cam"],


            "store_id":

            cfg["store"],


            "frames":

            frames_out

            },


            f

        )





    event_file = OUT_DIR / (video_path.stem + "_events.json")

    with open(event_file, "w") as f:
        json.dump(events, f, indent=2)


    total = sum(

        len(x["detections"])

        for x in frames_out

    )



    staff = sum(

        1

        for x in frames_out

        for d in x["detections"]

        if d["is_staff"]

    )




    print(
f"""
✅ Saved: {output_file.name}

Frames processed : {len(frames_out)}
Total detections : {total}

Customers        : {total-staff}
Staff            : {staff}\nEvents generated : {len(events)}

"""
    )






# ============================================================
# MAIN
# ============================================================



def main():


    print(
        "\n🚀 Loading YOLOv8 + ByteTrack..."
    )



    model = YOLO(
        MODEL_NAME
    )



    for video in VIDEOS:


        process_video(

            video,

            model

        )



    print(

        "\n🏆 DONE — VEYRA AI REAL MODE ACTIVE"

    )





if __name__ == "__main__":

    main()