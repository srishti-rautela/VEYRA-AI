def calculate_metrics(events):


    visitors = set()

    staff_members = set()

    dwell = []

    billing = set()



    for e in events:


        visitor_id = e.get(
            "visitor_id"
        )


        if not visitor_id:

            continue



        # STAFF COUNT FIX
        if e.get(
            "is_staff"
        ) == True:


            staff_members.add(
                visitor_id
            )

            continue



        # customers only
        visitors.add(
            visitor_id
        )



        dwell.append(

            e.get(
                "dwell_ms",
                0
            )

        )



        zone = e.get(
            "zone_id",
            ""
        )



        if "Billing" in zone:


            billing.add(
                visitor_id
            )




    total = len(
        visitors
    )



    return {


        "unique_visitors":

        total,



        "staff_count":

        len(
            staff_members
        ),



        "conversion_rate":

        round(

            (

            len(billing)

            /

            total

            *

            100

            )

            if total else 0,

            2

        ),



        "average_dwell_ms":

        int(

            sum(dwell)

            /

            len(dwell)

        )

        if dwell else 0,



        "billing_visitors":

        len(
            billing
        )

    }