import json
import os


INPUT_DIR = "frontend/public/detections"

OUTPUT = "event_log.jsonl"


with open(OUTPUT,"w") as out:


    for file in os.listdir(INPUT_DIR):


        if not file.endswith("_events.json"):
            continue


        path=os.path.join(
            INPUT_DIR,
            file
        )


        with open(path) as f:

            data=json.load(f)


        events = (

            data.get("events",[])

            if isinstance(data,dict)

            else data

        )


        for e in events:

            out.write(
                json.dumps(e)
                +
                "\n"
            )


print(
    "JSONL exported"
)