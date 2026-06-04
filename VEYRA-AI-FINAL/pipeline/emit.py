from uuid import uuid4
from datetime import datetime,timezone



def create_event(

    store_id,
    camera_id,
    visitor_id,
    event_type,
    zone,
    dwell_ms,
    confidence,
    is_staff,
    metadata=None

):


    return {


        "event_id":

        str(
            uuid4()
        ),


        "store_id":

        store_id,


        "camera_id":

        camera_id,


        "visitor_id":

        visitor_id,


        "event_type":

        event_type,


        "timestamp":

        datetime.now(
            timezone.utc
        ).isoformat(),


        "zone_id":

        zone,


        "dwell_ms":

        dwell_ms,


        "is_staff":

        is_staff,


        "confidence":

        round(
            float(confidence),
            3
        ),



        "metadata":

        metadata or {}

    }