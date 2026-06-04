from collections import defaultdict
import time


customer_memory = defaultdict(
    lambda: {
        "zones": [],
        "first_seen": time.time(),
        "last_seen": time.time()
    }
)


def update_customer_journey(detections):

    journeys = []


    for d in detections:

        if d.get("is_staff", False):
            continue


        customer_id = d.get(
            "id",
            "unknown"
        )


        zone = d.get(
            "section",
            "Unknown"
        )


        customer_memory[customer_id]["last_seen"] = time.time()


        if (
            len(customer_memory[customer_id]["zones"]) == 0
            or
            customer_memory[customer_id]["zones"][-1] != zone
        ):

            customer_memory[customer_id]["zones"].append(
                zone
            )


    for customer_id, data in list(customer_memory.items())[-5:]:


        dwell_time = int(
            time.time()
            -
            data["first_seen"]
        )


        purchase_intent = min(

            95,

            40
            +
            len(data["zones"]) * 15
            +
            dwell_time // 10

        )


        journeys.append({

            "customer_id":
            customer_id,


            "path":
            data["zones"],


            "dwell_time":
            dwell_time,


            "purchase_intent":
            purchase_intent

        })


    return journeys