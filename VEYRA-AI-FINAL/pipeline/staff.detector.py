import cv2
import numpy as np


def detect_staff(frame, box):

    x1,y1,x2,y2=box


    person=frame[
        y1:y2,
        x1:x2
    ]


    hsv=cv2.cvtColor(
        person,
        cv2.COLOR_BGR2HSV
    )


    brightness=np.mean(
        hsv[:,:,2]
    )


    return brightness < 70