def detect_anomalies(metrics):


    alerts=[]



    if (

        metrics[
            "conversion_rate"
        ]

        <

        0.25

    ):


        alerts.append({

        "type":

        "CONVERSION_DROP",


        "severity":

        "HIGH",


        "action":

        "Increase staff assistance"

        })



    if (

        metrics[
            "billing_visitors"
        ]

        >

        20

    ):


        alerts.append({

        "type":

        "QUEUE_SPIKE",


        "severity":

        "MEDIUM",


        "action":

        "Open additional billing counter"

        })



    return alerts