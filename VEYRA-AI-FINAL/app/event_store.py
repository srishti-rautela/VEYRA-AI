from collections import defaultdict


EVENTS = []

EVENT_IDS = set()


def ingest_events(events):

    accepted = 0
    failed = 0


    for e in events:


        event_id = e.get(
            "event_id"
        )


        if (
            not event_id
            or event_id in EVENT_IDS
        ):

            failed += 1
            continue



        EVENTS.append(e)

        EVENT_IDS.add(
            event_id
        )


        accepted += 1



    return {

        "accepted":accepted,

        "failed":failed,

        "total_events":len(EVENTS)

    }



def get_events(
    store_id=None
):


    if store_id is None:

        return EVENTS



    return [

        e for e in EVENTS

        if e.get(
            "store_id"
        ) == store_id

    ]