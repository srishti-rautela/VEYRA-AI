CAMERA_ZONE_MAP = {

    "s1c1": "Entry Gate",

    "s1c2": "Beauty Zone",

    "s1c3": "Product Discovery",

    "s1c5": "Billing Counter",


    "s2c1": "Entry Gate",

    "s2c2": "Store Zone",

    "s2c3": "Display Area",

    "s2c4": "Billing Counter"

}

def detect_handoff(events):

    paths = {}


    for e in events:

        vid = e.get(
            "visitor_id"
        )


        cam = (

            e.get("camera_id")

            or

            e.get("cam_id")

            or

            e.get("camera")

        )


        if not vid or not cam:
            continue


        if vid not in paths:
            paths[vid] = []


        if cam not in paths[vid]:
            paths[vid].append(cam)



    output = []


    for vid, cams in paths.items():


        if len(cams) > 1:


            zones = [

                {

                    "camera": c,

                    "area":

                        CAMERA_ZONE_MAP.get(
                            c,
                            "Unknown"
                        )

                }

                for c in cams

            ]



            converted = any(

                z["area"] == "Billing Counter"

                for z in zones

            )



            output.append({

                "visitor_id": vid,


                "journey": zones,


                "journey_type":

                    "Converted Customer"

                    if converted

                    else

                    "Browsing Customer",



                "handoffs":

                    len(cams)-1,


                "cameras_connected":

                    len(cams),


                "journey_status":

                    "Completed Purchase Journey"

                    if converted

                    else

                    "Exploring Store",


                "confidence":

                    round(

                        min(

                            0.99,

                            0.80 + (len(cams)*0.05)

                        ),

                        2

                    )

            })



    return output