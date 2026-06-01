import {useEffect,useState} from "react";

type Event={
 event_id:string;
 visitor_id:string;
 event_type:string;
 zone_id:string;
 confidence:number;
 timestamp:string;
 is_staff:boolean;
};


export default function EventStream(){

const [events,setEvents]=useState<Event[]>([]);


useEffect(()=>{

const timer=setInterval(async()=>{

try{

const res=
await fetch(
"http://localhost:8000/events/live"
);

const data=await res.json();

setEvents(data.events || []);

}catch{}

},1500);


return()=>clearInterval(timer);

},[]);



return(

<div className="panel-card">

<div className="panel-title">

⚡ Live AI Event Stream

<span className="panel-title-badge">
REAL TIME
</span>

</div>


<table className="event-table">

<thead>

<tr>

<th>Visitor</th>
<th>Event</th>
<th>Zone</th>
<th>Role</th>
<th>Confidence</th>

</tr>

</thead>


<tbody>


{events.map(e=>(

<tr key={e.event_id}>

<td>{e.visitor_id}</td>

<td>{e.event_type}</td>

<td>{e.zone_id}</td>

<td>

{
e.is_staff
?
"STAFF"
:
"CUSTOMER"
}

</td>


<td>

{
(e.confidence*100)
.toFixed(1)
}%

</td>

</tr>

))}


</tbody>


</table>


</div>

)

}