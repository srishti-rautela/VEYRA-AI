from collections import defaultdict



appearance_counter = defaultdict(int)

zone_counter = defaultdict(
    lambda:defaultdict(int)
)



STAFF_ZONES = [

    "Billing Queue",
    "Billing Counter",
    "Checkout"

]



def classify_person(

    track_id,
    zone

):


    appearance_counter[
        track_id
    ] += 1


    zone_counter[
        track_id
    ][zone] += 1



    frames = appearance_counter[
        track_id
    ]


    staff_zone_time = sum(

        zone_counter[
            track_id
        ][z]

        for z in STAFF_ZONES

    )


    if (

        frames > 80

        and

        staff_zone_time / frames > 0.55

    ):


        return True



    return False