def generate_funnel(events):


    entry=set()

    engaged=set()

    billing=set()



    for e in events:


        visitor = e.get(
            "visitor_id"
        )



        zone=e.get(
            "zone_id",
            ""
        )



        if e.get(
            "event_type"
        ) == "ENTRY":

            entry.add(
                visitor
            )



        if (

            "Zone"

            in zone

            or

            "Shelf"

            in zone

            or

            "Display"

            in zone

        ):


            engaged.add(
                visitor
            )



        if "Billing" in zone:


            billing.add(
                visitor
            )




    return {


        "entry":

        len(entry),



        "engaged":

        len(engaged),



        "billing":

        len(billing),



        "dropoff":

        max(

            0,

            len(entry)-len(billing)

        )

    }