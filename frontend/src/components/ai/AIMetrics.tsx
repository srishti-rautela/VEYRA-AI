import {
Users,
ShoppingBag,
Activity,
AlertTriangle
} from "lucide-react";


const data=[

{
title:"Customers",
value:"1,248",
icon:<Users/>
},

{
title:"Conversion",
value:"82%",
icon:<ShoppingBag/>
},

{
title:"AI Accuracy",
value:"96%",
icon:<Activity/>
},

{
title:"Alerts",
value:"3",
icon:<AlertTriangle/>
}

];


export default function AIMetrics(){

return (

<div className="metric-grid">

{
data.map((m)=>(

<div className="ai-card">

<div>
{m.icon}
</div>

<h3>{m.value}</h3>

<p>{m.title}</p>


</div>

))
}

</div>

)

}