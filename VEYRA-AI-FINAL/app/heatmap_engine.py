from collections import defaultdict


zone_memory = defaultdict(int)


def generate_yolo_heatmap(
    detections,
    existing_zones
):

    if not existing_zones:
        return []


    for d in detections:

        if d.get("is_staff"):
            continue


        zone = d.get(
            "section",
            "Unknown"
        )


        zone_memory[zone] += 1



    updated=[]


    for z in existing_zones:


        name = z.get(
            "name",
            ""
        )


        visits = zone_memory.get(
            name,
            0
        )


        intensity = min(
            100,
            visits * 8
        )


        new_zone = z.copy()


        if intensity >= 60:
            heat_status = "HOT 🔥"
            insight = (
        "High engagement zone - maintain inventory and staff presence"
    )
        elif intensity >= 25:
            heat_status = "ACTIVE 🟡"
            insight = (
        "Healthy customer interaction zone"
    )
        else:
            heat_status = "COLD ⚠"
            insight = (
        "Low engagement - consider promotions or layout change"
    )
    new_zone["intensity"] = intensity
    new_zone["visits"] = visits
    new_zone["data_confidence"] = "YOLO_REAL"
    new_zone["heat_status"] = heat_status
    new_zone["business_insight"] = insight
    new_zone["data_confidence"] = (
    "YOLO_REAL_AI_ENRICHED"
)
    
    
    updated.append(
            new_zone
        )


    return updated

from datetime import datetime


def generate_zone_heatmap(events):


    zones = {}


    for e in events:


        zone = (
            e.get("zone_id")
            or
            e.get("zone")
            or
            "Unknown"
        )


        if zone not in zones:

            zones[zone] = {

                "visitors": set(),

                "dwell": 0,

                "events": 0

            }



        visitor = e.get(
            "visitor_id"
        )


        if visitor:

            zones[zone]["visitors"].add(
                visitor
            )



        zones[zone]["dwell"] += e.get(
            "dwell_ms",
            0
        )


        zones[zone]["events"] += 1



    output=[]


    for zone,data in zones.items():


        visitors=len(
            data["visitors"]
        )


        avg_dwell=(

            data["dwell"]

            /

            data["events"]

            if data["events"]

            else 0

        )
        if visitors >= 30:
            level = "HOT 🔥"
            insight = (
        "High performing zone with strong customer engagement"
    )
        elif visitors >= 10:
            level = "ACTIVE 🟡"
            insight = (
        "Stable traffic zone"
    )
        else:
            level = "COLD ⚠"
            insight = (
        "Low traffic detected - optimize placement"
    )



        


        output.append({


    "zone":

    zone,


    "visitor_count":

    visitors,


    "avg_dwell_ms":

    round(
        avg_dwell,
        2
    ),


    "heat_level":

    level,


    "business_insight":

    insight,


    "intensity":

    min(
        100,
        visitors*3
    )

})


    return {


        "generated_at":

        datetime.now().isoformat(),


        "zones":

        sorted(

            output,

            key=lambda x:x["intensity"],

            reverse=True

        )

    }