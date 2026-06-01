import { motion } from "framer-motion";

import {
 Brain,
 ShieldCheck,
 Activity,
 CheckCircle
} from "lucide-react";


export default function FinalAICards(){


const cards=[

{
icon:<Brain/>,
title:"AI Explainability Engine",
tag:"TRANSPARENT AI",
items:[
"Detected: CUSTOMER",
"✓ Entrance behaviour verified",
"✓ Shopping movement detected",
"✓ Staff pattern excluded",
"Confidence: 92%"
]
},


{
icon:<ShieldCheck/>,
title:"Privacy Shield AI",
tag:"PRIVACY FIRST",
items:[
"No face recognition",
"Anonymous visitor IDs",
"No biometric storage",
"Event-based intelligence"
]
},


{
icon:<Activity/>,
title:"Veyra System Health",
tag:"LIVE",
items:[
"YOLO Engine: ACTIVE",
"Camera Network: 5/5 Online",
"API Status: Healthy",
"Tests: 140 Passed"
]
}

];


return(

<div className="final-ai-grid">


{

cards.map((card,index)=>(


<motion.div

className="final-ai-card"

key={card.title}

initial={{
opacity:0,
y:30
}}

animate={{
opacity:1,
y:0
}}

transition={{
delay:index*.15
}}

>


<div className="final-card-header">


<div className="final-icon">

{card.icon}

</div>


<span>

{card.tag}

</span>


</div>


<h2>

{card.title}

</h2>


<ul>


{

card.items.map(
(i)=>(

<li key={i}>

<CheckCircle size={14}/>

{i}

</li>

)

)

}


</ul>


</motion.div>


))

}


</div>

)

}