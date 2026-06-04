def compare_stores(store_data):

    result = {}

    scores = {}


    for store, data in store_data.items():


        detections = data.get(
            "detections",
            []
        )


        customers = [
            d for d in detections
            if not d.get("is_staff")
        ]


        staff = [
            d for d in detections
            if d.get("is_staff")
        ]


        score = min(

            100,

            len(customers)*10

            +

            len(staff)*15

        )


        scores[store] = score


        result[store] = {

            "customers":
            len(customers),


            "staff":
            len(staff),


            "performance":
            score

        }



    if scores:


        winner = max(
            scores,
            key=scores.get
        )


    else:

        winner = None



    return {

        "winner":
        winner,


        "stores":
        result,


        "recommendation":
        "Optimize staff allocation based on customer density"

    }