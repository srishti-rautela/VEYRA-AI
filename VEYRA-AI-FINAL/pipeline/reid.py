import time



memory={}



def get_reid(

    track_id,

    bbox

):


    now=time.time()



    if track_id in memory:


        memory[
            track_id
        ][
            "last_seen"
        ] = now


        return (

            memory[
                track_id
            ][
                "visitor_id"
            ],

            False

        )



    visitor_id = (

        "VIS_"

        +

        str(

            len(memory)+1

        ).zfill(5)

    )



    memory[
        track_id
    ]={

        "visitor_id":
        visitor_id,


        "bbox":
        bbox,


        "last_seen":
        now

    }



    return visitor_id, True