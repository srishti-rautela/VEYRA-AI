import { Brain } from "lucide-react";
import { motion } from "framer-motion";

export default function AIHeader(){

return (
<motion.div
className="ai-header"
initial={{opacity:0,y:-20}}
animate={{opacity:1,y:0}}
>

<div>

<h1>
<Brain/> VEYRA AI -: THE ULTIMATE VISION OS
</h1>

<p>
Real Time Retail Intelligence powered by YOLOv8
</p>

</div>


<div className="live">

● AI LIVE

</div>


</motion.div>
)

}