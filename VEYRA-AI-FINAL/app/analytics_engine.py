"""
VEYRA AI Intelligence Engine
Retail Decision Layer
"""

from collections import Counter


def generate_ai_insights(detections):

    insights = []


    if detections is None:
        detections = []


    customers = [
        d for d in detections
        if not d.get("is_staff", False)
    ]


    staff = [
        d for d in detections
        if d.get("is_staff", False)
    ]


    # =====================
    # TRAFFIC INSIGHT
    # =====================

    if len(customers) >= 5:

        insights.append({

            "type": "traffic",

            "title": "👥 High Customer Traffic",

            "message":
            f"{len(customers)} customers currently active in store",

            "priority": "medium"

        })


    # =====================
    # HOT ZONE
    # =====================

    zones = [
        d.get("section", "Unknown")
        for d in customers
    ]


    if zones:

        zone, count = Counter(
            zones
        ).most_common(1)[0]


        insights.append({

            "type": "zone",

            "title": "🔥 Hot Zone",

            "message":
            f"{zone} getting maximum attention ({count} visitors)",

            "priority": "high"

        })



    # =====================
    # STAFF ALERT
    # =====================

    if (
        len(customers) >= 3
        and
        len(staff) == 0
    ):

        insights.append({

            "type": "staff",

            "title":
            "⚠ Staff Required",

            "message":
            "Customers need assistance in active zones",

            "priority":
            "high"

        })



    # =====================
    # QUEUE
    # =====================


    billing = [

        d for d in customers

        if "Billing"
        in d.get("section", "")

        or

        "Queue"
        in d.get("section", "")

    ]


    if len(billing) >= 2:

        insights.append({

            "type":"queue",

            "title":
            "⏱ Queue Alert",

            "message":
            "Billing congestion detected. Open another counter.",

            "priority":"critical"

        })



    # =====================
    # CONVERSION SCORE
    # =====================


    score = min(

        95,

        45 + len(customers)*7

    )


    insights.append({

        "type":"conversion",

        "title":
        "📈 Conversion Prediction",

        "message":
        f"Purchase probability estimated at {score}%",

        "priority":
        "medium"

    })



    return insights
