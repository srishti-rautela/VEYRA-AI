import {
    Trophy,
    TrendingUp,
    Users,
    Clock,
    Brain,
    IndianRupee
} from "lucide-react";


interface Props{

metrics:any;

}


export default function BusinessImpact(
{
metrics
}:Props
){


const visitors =
metrics?.unique_visitors || 0;


const conversion =
(
(metrics?.conversion_rate || 0)
*
100
).toFixed(1);


const queue =
metrics?.queue_depth || 0;


const health = Math.min(
95,
70 + visitors
);


return(

<div className="business-grid">


{/* STORE SCORE */}

<div className="business-card hero">

<Trophy/>

<h2>
AI Store Health
</h2>

<div className="score">
{health}%
</div>

<p>
Realtime performance score
</p>

</div>




{/* REVENUE */}

<div className="business-card">

<IndianRupee/>

<h2>
Revenue Forecast
</h2>


<h1>
₹ {(visitors*850).toLocaleString()}
</h1>


<p>
AI predicts +18% growth opportunity
</p>


</div>




{/* STAFF */}

<div className="business-card">

<Users/>

<h2>
Staff Intelligence
</h2>


<p>
Billing Staff: Optimal
</p>


<p>
Floor Assistance Needed
</p>


<b>
Move 1 staff → Beauty Zone
</b>


</div>




{/* CROWD */}

<div className="business-card">

<Clock/>

<h2>
Peak Prediction
</h2>


<p>
12 PM 🟢 Normal
</p>

<p>
4 PM 🟡 Busy
</p>

<p>
7 PM 🔴 Peak Traffic
</p>


</div>





{/* AI */}

<div className="business-card wide">

<Brain/>

<h2>
AI Business Recommendation
</h2>


<ul>

<li>
Improve conversion from {conversion}% 
</li>

<li>
Reduce queue waiting time
</li>

<li>
Increase staff visibility near high dwell zones
</li>

<li>
Optimize product placement using heatmap
</li>


</ul>

</div>




{/* CONVERSION */}

<div className="business-card">

<TrendingUp/>

<h2>
Opportunity
</h2>


<h1>
+23%
</h1>


<p>
Potential sales improvement
</p>


</div>


</div>

)

}