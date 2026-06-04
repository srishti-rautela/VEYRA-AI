import time
from collections import defaultdict


class SessionManager:


    def __init__(self):

        self.sessions = defaultdict(
            lambda:{
                "first_seen":time.time(),
                "last_seen":time.time(),
                "zones":[],
                "active":True
            }
        )



    def update(
        self,
        visitor_id,
        zone
    ):


        s = self.sessions[
            visitor_id
        ]


        now = time.time()


        s["last_seen"] = now


        if (
            len(s["zones"]) == 0
            or s["zones"][-1] != zone
        ):

            s["zones"].append(
                zone
            )


        return {


            "visitor_id":
            visitor_id,


            "dwell_ms":
            int(
                (
                    now -
                    s["first_seen"]
                )
                *
                1000
            ),


            "path":
            s["zones"]

        }