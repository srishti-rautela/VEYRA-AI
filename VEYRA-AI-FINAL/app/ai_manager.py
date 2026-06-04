from datetime import datetime


def generate_store_advice(metrics):

    insights = []


    visitors = metrics.get(
        "unique_visitors",
        0
    )


    queue = metrics.get(
        "queue_depth",
        0
    )


    conversion = metrics.get(
        "conversion_rate",
        0
    )


    staff = metrics.get(
        "staff_count",
        0
    )


    health = metrics.get(
        "store_health_score",
        0
    )



    if queue >= 4:


        insights.append({

            "category":
            "Operations",

            "title":
            "Billing Bottleneck Detected",

            "severity":
            "CRITICAL",

            "business_impact":
            "Long waiting time may reduce customer satisfaction",

            "recommendation":
            "Deploy additional billing staff immediately",

            "confidence":
            94

        })



    if visitors > 60 and staff < 5:


        insights.append({

            "category":
            "Staff Optimization",

            "title":
            "Staff Shortage Prediction",

            "severity":
            "HIGH",

            "business_impact":
            "High customer load compared to available staff",

            "recommendation":
            "Move available staff to high traffic zones",

            "confidence":
            89

        })



    if conversion < 50:


        insights.append({

            "category":
            "Revenue",

            "title":
            "Conversion Improvement Opportunity",

            "severity":
            "MEDIUM",

            "business_impact":
            "Visitors are browsing without purchasing",

            "recommendation":
            "Trigger personalized offers in active zones",

            "confidence":
            86

        })



    if health >= 90:


        insights.append({

            "category":
            "Performance",

            "title":
            "Store Performing Efficiently",

            "severity":
            "INFO",

            "business_impact":
            "Customer journey flow is healthy",

            "recommendation":
            "Maintain current operational strategy",

            "confidence":
            97

        })



        insights.append({

        "category":
        "AI Prediction",

        "title":
        "Next Hour Store Forecast",

        "severity":
        "SMART",

        "business_impact":
        "Traffic trend analysis predicts upcoming operational load",

        "recommendation":
        "Prepare staff allocation before next visitor peak",

        "confidence":
        91

    })


    insights.append({

        "category":
        "Revenue Intelligence",

        "title":
        "Sales Growth Opportunity",

        "severity":
        "SMART",

        "business_impact":
        "High engagement zones can increase conversion",

        "recommendation":
        "Promote top performing brands in active zones",

        "confidence":
        88

    })


    return {

        "assistant":
        "VEYRA AI Store Manager",


        "generated_at":
        datetime.now().isoformat(),


        "total_insights":
        len(insights),


        "insights":
        insights

    }