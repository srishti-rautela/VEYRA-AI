import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Zone { id:string;name:string;x:number;y:number;w:number;h:number;type?:string;intensity?:number;visits?:number;avg_dwell_s?:number;data_confidence?:string }
interface Person { id:string;x:number;y:number;label:string;color:string;is_staff:boolean;gender?:string;target_zone?:string }
interface YoloDet { id:string;label:string;section:string;confidence:number;color:string;x:number;y:number;is_staff:boolean }
interface LiveEvent { event_type:string;zone_name?:string;visitor_id?:string;gender?:string;timestamp:string;store_id:string;is_staff?:boolean }
interface Metrics { unique_visitors:number;current_in_store:number;conversion_rate:number;purchases:number;queue_depth:number;abandonment_rate:number;store_health_score:number;gender_split:{M:number;F:number};hourly_traffic:number[];revenue_today:number;top_brands:{name:string;revenue:number}[];avg_dwell_per_zone:Record<string,number>;entries:number;exits:number;age_distribution?:Record<string,number>;staff_count?:number }
interface Anomaly { type:string;severity:string;message:string;suggested_action:string;timestamp:string }
interface FunnelStage { stage:string;count:number;pct:number }

const API = 'http://localhost:8000'
const WS  = 'ws://localhost:8000/ws'

const STORES = [
  { id:'ST1008', name:'Store 1', city:'Mumbai Central', cams:[
    { id:'s1c1', label:'Cam 1 — Entry',   src:'/store1_cam1_entry.mp4',   fallback:'/store1_cam2_zone.mp4' },
    { id:'s1c2', label:'Cam 2 — Zone A',  src:'/store1_cam2_zone.mp4',    fallback:'/store1_cam2_zone.mp4' },
    { id:'s1c3', label:'Cam 3 — Zone B',  src:'/store1_cam3_zone.mp4',    fallback:'/store1_cam2_zone.mp4' },
    { id:'s1c5', label:'Cam 5 — Billing', src:'/store1_cam5_billing.mp4', fallback:'/store1_cam2_zone.mp4' },
  ], layout:null, color:'#00ffc8' },
  { id:'ST1076', name:'Store 2', city:'Bandra West', cams:[
    { id:'s2c1', label:'Cam 1 — Entry',   src:'/store2_cam1_entry.mp4',   fallback:'/store2_cam_zone.mp4' },
    { id:'s2c2', label:'Cam 2 — Zone',    src:'/store2_cam_zone.mp4',     fallback:'/store2_cam_zone.mp4' },
    { id:'s2c3', label:'Cam 3 — Display', src:'/store2_cam3_display.mp4', fallback:'/store2_cam_zone.mp4' },
    { id:'s2c4', label:'Cam 4 — Billing', src:'/store2_cam_billing.mp4',  fallback:'/store2_cam_billing.mp4' },
  ], layout:'/store2_layout.png', color:'#ff6b35' },
]

const DET_COLOR: Record<string,string> = { 'Customer-F':'#ff4fa3','Customer-M':'#00e5a0','Staff':'#38c4ff' }
const DET_ICON:  Record<string,string> = { 'Customer-F':'♀','Customer-M':'♂','Staff':'★' }

function heatFill(i:number):string {
  if(i<20) return 'rgba(56,196,255,0.15)'; if(i<40) return 'rgba(56,196,255,0.28)'
  if(i<60) return 'rgba(255,196,0,0.35)';  if(i<80) return 'rgba(255,107,53,0.48)'
  return 'rgba(255,50,80,0.65)'
}
function heatBorder(i:number):string {
  if(i<20) return '#38c4ff'; if(i<40) return '#38c4ff'
  if(i<60) return '#ffc400'; if(i<80) return '#ff6b35'; return '#ff3250'
}
function heatWord(i:number):string {
  if(i<20) return 'Cold'; if(i<40) return 'Cool'; if(i<60) return 'Warm'; if(i<80) return 'Hot'; return 'CRITICAL'
}

function useTheme() {
  return { dark: true, toggleDark: () => {} }
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        position: 'relative', width: 52, height: 28, borderRadius: 14,
        background: dark ? 'rgba(0,255,200,0.15)' : 'rgba(255,200,0,0.15)',
        border: `1.5px solid ${dark ? 'rgba(0,255,200,0.4)' : 'rgba(255,180,0,0.5)'}`,
        cursor: 'pointer', transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0,
        boxShadow: dark ? '0 0 12px rgba(0,255,200,0.15)' : '0 0 12px rgba(255,200,0,0.2)',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: dark ? '#00ffc8' : '#fbbf24',
        transform: dark ? 'translateX(0px)' : 'translateX(24px)',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, boxShadow: dark ? '0 0 8px rgba(0,255,200,0.6)' : '0 0 8px rgba(251,191,36,0.6)',
      }}>
        {dark ? '🌙' : '☀️'}
      </div>
    </button>
  )
}

function useApi<T>(path:string, interval=4000) {
  const [data,setData] = useState<T|null>(null)
  const fetch_ = useCallback(()=>{ fetch(`${API}${path}`).then(r=>r.json()).then(setData).catch(()=>{}) },[path])
  useEffect(()=>{ fetch_(); const t=setInterval(fetch_,interval); return()=>clearInterval(t) },[fetch_,interval])
  return data
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible,setVisible] = useState(false)
  useEffect(()=>{
    const obs = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setVisible(true) },{ threshold:0.08 })
    if(ref.current) obs.observe(ref.current)
    return()=>obs.disconnect()
  },[])
  return { ref, visible }
}

function AnimNum({ target, duration=1400 }:{ target:number; duration?:number }) {
  const [n,setN] = useState(0)
  const prev = useRef(0)
  useEffect(()=>{
    const start=prev.current; const diff=target-start; const t0=Date.now()
    const frame=()=>{
      const p=Math.min((Date.now()-t0)/duration,1)
      const ease=1-Math.pow(1-p,4)
      setN(Math.round(start+diff*ease))
      if(p<1) requestAnimationFrame(frame); else prev.current=target
    }
    requestAnimationFrame(frame)
  },[target])
  return <>{n.toLocaleString()}</>
}

function KpiCard({ value,label,icon,accent,suffix='',sublabel='',dark }:{ value:number;label:string;icon:string;accent:string;suffix?:string;sublabel?:string;dark:boolean }) {
  const { ref,visible } = useReveal()
  const [hovered,setHovered] = useState(false)
  return (
    <div ref={ref}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{
        background: dark
          ? `linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.015) 100%)`
          : `linear-gradient(135deg,rgba(232,238,250,0.92) 0%,rgba(255,255,255,0.85) 100%)`,
        border: `1px solid ${hovered ? accent+'55' : accent+'22'}`,
        borderRadius: 18,
        padding:'24px 24px',minHeight:135,
        position: 'relative', overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? 'translateY(-4px)' : 'none') : 'translateY(28px)',
        transition: 'opacity 0.55s, transform 0.55s cubic-bezier(0.16,1,0.3,1), border-color 0.3s, box-shadow 0.3s',
        boxShadow: hovered
          ? `0 12px 40px ${accent}22, 0 0 0 1px ${accent}18`
          : dark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(16px)',
        cursor: 'default',
      }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${accent},transparent)`,opacity:hovered?1:0.4,transition:'opacity 0.3s' }} />
      <div style={{ position:'absolute',top:-20,right:-20,width:80,height:80,borderRadius:'50%',background:accent,opacity:0.05,filter:'blur(20px)',transition:'opacity 0.3s',pointerEvents:'none' }} />
      <div style={{ position:'absolute',top:14,right:16,fontSize:20,opacity:0.15 }}>{icon}</div>
      <div style={{ color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)', fontSize:10,letterSpacing:2,textTransform:'uppercase',marginBottom:8,fontFamily:'var(--mono)' }}>{label}</div>
      <div style={{ fontSize:'clamp(24px,2.5vw,36px)',fontWeight:900,letterSpacing:-1,color:accent,fontFamily:'var(--display)',lineHeight:1.2,overflow:'visible',wordBreak:'break-word' }}>
        {visible ? <AnimNum target={value} /> : '0'}{suffix}
      </div>
      {sublabel && <div style={{ color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.4)', fontSize:11,marginTop:6 }}>{sublabel}</div>}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${accent}22,transparent)` }} />
    </div>
  )
}

function CamFeed({ cam, detections, highlight=false, dark }:{ cam:typeof STORES[0]['cams'][0]; detections:YoloDet[]; highlight?:boolean; dark:boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loaded,setLoaded] = useState(false)
  const [err,setErr] = useState(false)
  const [time,setTime] = useState('')
  const [hovered,setHovered] = useState(false)

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date().toLocaleTimeString('en-IN',{hour12:false})),1000)
    return()=>clearInterval(t)
  },[])
  useEffect(()=>{ if(videoRef.current) videoRef.current.playbackRate=0.9 },[loaded])
  const handleErr=()=>{
    if(videoRef.current && cam.fallback && videoRef.current.src!==window.location.origin+cam.fallback) {
      videoRef.current.src=cam.fallback; videoRef.current.load()
    } else setErr(true)
  }
  const gridDets=detections.map(d=>({...d,gx:d.x,gy:d.y}))

  return (
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{
        background: dark ? 'rgba(6,10,20,0.8)' : 'rgba(255,255,255,0.9)',
        border: `1px solid ${highlight||hovered ? 'var(--accent1)' : dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 16, overflow: 'hidden', position: 'relative',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        boxShadow: hovered ? `0 8px 32px var(--accent1)18` : 'none',
      }}>
      <div style={{ padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.08)'}`,background:dark?'rgba(0,0,0,0.5)':'rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:7 }}>
          <div style={{ width:7,height:7,borderRadius:'50%',background:'#ff3250',animation:'blink 1s infinite',boxShadow:'0 0 6px #ff325066' }} />
          <span style={{ fontFamily:'var(--mono)',fontSize:10,color: dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.5)',letterSpacing:1 }}>{cam.label}</span>
        </div>
        <div style={{ display:'flex',gap:10,alignItems:'center' }}>
          <span style={{ fontFamily:'var(--mono)',fontSize:9,color:'var(--accent1)',background:'rgba(0,255,200,0.1)',padding:'2px 7px',borderRadius:4 }}>YOLOv8</span>
          <span style={{ fontFamily:'var(--mono)',fontSize:9,color: dark?'#444':'#aaa' }}>30FPS</span>
        </div>
      </div>

      <div style={{ position:'relative',background:'#000',aspectRatio:'16/9' }}>
        {!err ? (
          <video ref={videoRef} src={cam.src} autoPlay loop muted playsInline
            onLoadedData={()=>setLoaded(true)} onError={handleErr}
            style={{ width:'100%',height:'100%',objectFit:'cover',display:'block' }} />
        ) : (
          <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10,background:'#060a14' }}>
            <div style={{ fontSize:32,opacity:0.4 }}>📷</div>
            <div style={{ fontFamily:'var(--mono)',fontSize:10,color:'#444',letterSpacing:2 }}>FEED OFFLINE</div>
            <div style={{ fontFamily:'var(--mono)',fontSize:9,color:'#333' }}>{cam.label}</div>
          </div>
        )}

        {gridDets.map(d=>{
          const col=DET_COLOR[d.label]??'#fff'
          return (
            <div key={d.id} style={{
              position:'absolute', left:`${Math.min(Math.max(d.gx-5,0),88)}%`, top:`${Math.min(Math.max(d.gy-22,0),82)}%`,
              pointerEvents:'none', display:'flex', flexDirection:'column', alignItems:'center',
              transition:'left 1s ease, top 1s ease',
            }}>
              <div style={{ background:col,borderRadius:7,padding:'3px 9px',whiteSpace:'nowrap',boxShadow:`0 0 12px ${col}99`,display:'flex',alignItems:'center',gap:5 }}>
                <span style={{ fontSize:10,fontWeight:900,color:'#000',fontFamily:'Fira Code,monospace' }}>{DET_ICON[d.label]} {d.label} #{d.id.split('_P')[1]}</span>
                <span style={{ fontSize:9,color:'rgba(0,0,0,0.5)',fontFamily:'Fira Code,monospace' }}>{Math.round(d.confidence*100)}%</span>
              </div>
              <div style={{ width:1,height:10,background:col,opacity:0.6 }} />
              <div style={{ width:7,height:7,borderRadius:'50%',background:col,boxShadow:`0 0 8px ${col}` }} />
              <div style={{ fontSize:8,color:col,fontFamily:'Fira Code,monospace',background:'rgba(0,0,0,0.85)',padding:'1px 5px',borderRadius:3,marginTop:2,whiteSpace:'nowrap' }}>📍 {d.section}</div>
            </div>
          )
        })}

        <div style={{ position:'absolute',top:7,left:7,fontFamily:'var(--mono)',fontSize:9,color:'var(--accent1)',background:'rgba(0,0,0,0.8)',padding:'3px 8px',borderRadius:5,backdropFilter:'blur(8px)',letterSpacing:0.5 }}>DET: {detections.length}</div>
        <div style={{ position:'absolute',bottom:6,left:7,fontFamily:'var(--mono)',fontSize:9,color:'rgba(255,255,255,0.5)',background:'rgba(0,0,0,0.7)',padding:'2px 8px',borderRadius:4 }}>{time}</div>
        <div style={{ position:'absolute',bottom:6,right:7,fontFamily:'var(--mono)',fontSize:9,color:'#00e5a0',background:'rgba(0,0,0,0.7)',padding:'2px 8px',borderRadius:4,animation:'pulse-badge 2s infinite' }}>● LIVE</div>
        <div style={{ position:'absolute',left:0,right:0,height:1.5,background:'linear-gradient(90deg,transparent,rgba(0,229,160,0.5),transparent)',animation:'scanline 3s linear infinite',pointerEvents:'none' }} />
      </div>

      <div style={{ padding:'8px 12px',display:'flex',gap:5,flexWrap:'wrap',minHeight:38,background:dark?'rgba(0,0,0,0.35)':'rgba(0,0,0,0.03)',borderTop:`1px solid ${dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)'}` }}>
        {gridDets.map(d=>{
          const c=DET_COLOR[d.label]??'#fff'
          return (
            <div key={d.id} style={{ display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:6,background:`${c}10`,border:`1px solid ${c}38`,fontFamily:'var(--mono)',fontSize:9,whiteSpace:'nowrap' }}>
              <div style={{ width:5,height:5,borderRadius:'50%',background:c }} />
              <span style={{ color:c,fontWeight:700 }}>{d.label}</span>
              <span style={{ color: dark?'#444':'#bbb' }}>·</span>
              <span style={{ color: dark?'#555':'#999' }}>{d.section}</span>
            </div>
          )
        })}
        {detections.length===0 && <span style={{ fontSize:9,color: dark?'#333':'#bbb',alignSelf:'center' }}>No detections</span>}
      </div>
    </div>
  )
}

function LiveHeatmap({ zones,persons,layoutSrc,accentColor,dark }:{ zones:Zone[];persons:Person[];layoutSrc?:string|null;accentColor:string;dark:boolean }) {
  const [tip,setTip] = useState<Zone|null>(null)
  const [tipPos,setTipPos] = useState({x:0,y:0})
  const svgRef = useRef<SVGSVGElement>(null)
  return (
    <div style={{ position:'relative',borderRadius:14,overflow:'hidden',border:`1px solid ${accentColor}28`,background:dark?'#070b16':'#f0f4ff' }}>
      {layoutSrc && <img src={layoutSrc} alt="" style={{ width:'100%',display:'block',opacity:0.12,filter:'brightness(0.4) saturate(0.2)',position:'absolute',inset:0,height:'100%',objectFit:'cover' }} />}
      {!layoutSrc && <div style={{ paddingBottom:'52%' }} />}
      {layoutSrc && <div style={{ paddingBottom:'52%' }} />}

      <svg ref={svgRef} style={{ position:'absolute',top:0,left:0,width:'100%',height:'100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id="glow2"><feGaussianBlur stdDeviation="0.8" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        {zones.map(z=>{
          const i=z.intensity??0
          return (
            <g key={z.id}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={heatFill(i)} stroke={heatBorder(i)} strokeWidth={0.25} rx={0.6}
                style={{ cursor:'pointer',filter:i>70?'url(#glow2)':'none',transition:'fill 0.5s' }}
                onMouseEnter={e=>{ setTip(z); const r=svgRef.current!.getBoundingClientRect(); setTipPos({x:e.clientX-r.left,y:e.clientY-r.top}) }}
                onMouseLeave={()=>setTip(null)} />
              <text x={z.x+z.w/2} y={z.y+z.h/2-1.5} textAnchor="middle" fill="white" fontSize={Math.min(z.w,z.h)*0.17} fontFamily="Syne" fontWeight="700" opacity={0.9}>{z.name.split(' ').slice(0,2).join(' ')}</text>
              <text x={z.x+z.w/2} y={z.y+z.h/2+3} textAnchor="middle" fill={heatBorder(i)} fontSize={Math.min(z.w,z.h)*0.15} fontFamily="monospace" fontWeight="600">{i}%</text>
            </g>
          )
        })}
        {persons.map(p=>(
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r={1.4} fill="none" stroke={p.color} strokeWidth={0.22} opacity={0.35} style={{ animation:'ripple 2s ease-out infinite' }} />
            <circle cx={p.x} cy={p.y} r={0.9} fill={p.color} opacity={0.95} style={{ filter:`drop-shadow(0 0 1.8px ${p.color})` }} />
            {p.is_staff && (
              <>
                <circle cx={p.x} cy={p.y} r={1.5} fill="none" stroke="#38c4ff" strokeWidth={0.3} strokeDasharray="0.7 0.4" />
                <text x={p.x} y={p.y-2} textAnchor="middle" fill="#38c4ff" fontSize={1.3} fontFamily="monospace" fontWeight="800">STAFF</text>
              </>
            )}
          </g>
        ))}
      </svg>

      {tip && (
        <div style={{ position:'absolute',left:tipPos.x+12,top:Math.max(0,tipPos.y-100),background:dark?'rgba(4,8,20,0.97)':'rgba(255,255,255,0.97)',border:`1.5px solid ${heatBorder(tip.intensity??0)}`,borderRadius:12,padding:'12px 16px',pointerEvents:'none',zIndex:20,minWidth:160,backdropFilter:'blur(20px)',boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ fontWeight:800,color:heatBorder(tip.intensity??0),fontSize:12,marginBottom:6,fontFamily:'var(--display)' }}>{tip.name}</div>
          <div style={{ color:dark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.55)',fontSize:10,lineHeight:1.9,fontFamily:'var(--mono)' }}>
            🌡 {heatWord(tip.intensity??0)} · {tip.intensity}%<br/>
            👥 {tip.visits??0} visits<br/>
            ⏱ {tip.avg_dwell_s??0}s dwell<br/>
            📶 {tip.data_confidence}<br/>
            🧠 {(tip as any).business_insight??'AI zone intelligence active'}
          </div>
        </div>
      )}

      <div style={{ position:'absolute',top:8,right:10,display:'flex',gap:8,alignItems:'center',background:dark?'rgba(0,0,0,0.6)':'rgba(255,255,255,0.85)',padding:'4px 10px',borderRadius:20,backdropFilter:'blur(8px)' }}>
        {[['Cold','#38c4ff'],['Warm','#ffc400'],['Critical','#ff3250']].map(([l,c])=>(
          <div key={l} style={{ display:'flex',alignItems:'center',gap:4 }}>
            <div style={{ width:8,height:8,borderRadius:2,background:c as string,boxShadow:`0 0 6px ${c}` }} />
            <span style={{ fontSize:8,color: dark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)',fontFamily:'var(--mono)' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompareModal({ data,onClose,dark }:{ data:{ST1008:Zone[],ST1076:Zone[]}; onClose:()=>void; dark:boolean }) {
  const { ref,visible } = useReveal()
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)',animation:'fadeIn 0.2s ease' }} onClick={onClose}>
      <div ref={ref} onClick={e=>e.stopPropagation()} style={{
        background: dark ? 'rgba(8,14,26,0.98)' : 'rgba(255,255,255,0.98)',
        border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)',
        borderRadius:22,padding:32,width:'92vw',maxWidth:1100,maxHeight:'88vh',overflowY:'auto',
        opacity:visible?1:0,transform:visible?'none':'scale(0.94) translateY(20px)',
        transition:'opacity 0.35s,transform 0.35s cubic-bezier(0.16,1,0.3,1)',
        boxShadow:'0 40px 100px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24 }}>
          <h2 style={{ fontFamily:'var(--display)',fontSize:22,fontWeight:900,letterSpacing:-0.5 }}>
            <span style={{ color:'var(--accent1)' }}>⚡</span> Store Comparison
          </h2>
          <button onClick={onClose} style={{ background:'none',border:`1px solid ${dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.12)'}`,color: dark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)',borderRadius:10,padding:'7px 16px',cursor:'pointer',fontFamily:'var(--body)',fontSize:12,transition:'all 0.2s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent1)';e.currentTarget.style.color='var(--accent1)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.12)';e.currentTarget.style.color=dark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)'}}>
            ✕ Close
          </button>
        </div>

        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24 }}>
          {(['ST1008','ST1076'] as const).map((sid,si)=>{
            const zones=data[sid]
            const peak=zones.reduce((a,b)=>(b.intensity??0)>(a.intensity??0)?b:a,zones[0]??{name:'-',intensity:0})
            const accent=si===0?'var(--accent1)':'var(--accent2)'
            return (
              <div key={sid} style={{ background:dark?'rgba(255,255,255,0.025)':'rgba(0,0,0,0.025)',borderRadius:16,padding:22,minHeight:'fit-content',overflow:'visible',border:`1px solid ${si===0?'#00ffc818':'#ff6b3518'}` }}>
                <div style={{ fontFamily:'var(--display)',fontSize:14,fontWeight:800,marginBottom:14,color:accent }}>
                  {si===0?'🏬 Store 1 — Mumbai Central':'🏪 Store 2 — Bandra West'}
                </div>
                <div style={{ height:3,borderRadius:2,background:'linear-gradient(90deg,#38c4ff,#ffc400,#ff3250)',marginBottom:16,opacity:0.5 }} />
                {zones.sort((a,b)=>(b.intensity??0)-(a.intensity??0)).map(z=>(
                  <div key={z.id} style={{ marginBottom:9 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
                      <span style={{ fontSize:10,color:dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.5)',fontFamily:'var(--mono)' }}>{z.name}</span>
                      <span style={{ fontSize:10,color:heatBorder(z.intensity??0),fontFamily:'var(--mono)',fontWeight:700 }}>{z.intensity??0}%</span>
                    </div>
                    <div style={{ height:5,background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.08)',borderRadius:3 }}>
                      <div style={{ height:'100%',width:`${z.intensity??0}%`,background:`linear-gradient(90deg,${heatBorder(z.intensity??0)}88,${heatBorder(z.intensity??0)})`,borderRadius:3,transition:'width 0.6s' }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop:14,padding:'9px 12px',background:dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',borderRadius:9,fontSize:11,color:dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.5)',fontFamily:'var(--mono)' }}>
                  🔥 Peak: <span style={{ color:heatBorder(peak?.intensity??0),fontWeight:700 }}>{peak?.name}</span> ({peak?.intensity}%)
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ height:230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.ST1008.slice(0,10).map((z,i)=>({ zone:z.name.slice(0,9), S1:z.intensity??0, S2:data.ST1076[i]?.intensity??0 }))} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke={dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)'} />
              <XAxis dataKey="zone" tick={{ fill:dark?'#555':'#999',fontSize:9,fontFamily:'monospace' }} />
              <YAxis tick={{ fill:dark?'#555':'#999',fontSize:9 }} />
              <Tooltip contentStyle={{ background:dark?'#0a0e1a':'#fff',border:`1px solid ${dark?'#1e2535':'#e0e0e0'}`,borderRadius:10,fontSize:11,color:dark?'#e2e8f0':'#333' }} />
              <Bar dataKey="S1" fill="#00ffc8" radius={[4,4,0,0]} opacity={0.85} name="Store 1" />
              <Bar dataKey="S2" fill="#ff6b35" radius={[4,4,0,0]} opacity={0.85} name="Store 2" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function EventTicker({ events,dark }:{ events:LiveEvent[]; dark:boolean }) {
  const TYPE_COL: Record<string,string> = { entry:'#00e5a0',exit:'#ff4f4f',zone_entered:'#38c4ff',zone_exited:'#a78bfa',queue_completed:'#fbbf24',queue_abandoned:'#fb923c' }
  return (
    <div style={{ display:'flex',alignItems:'center',gap:10,overflowX:'auto',padding:'0 4px' }}>
      <span style={{ fontSize:9,color:'var(--accent1)',letterSpacing:2,whiteSpace:'nowrap',fontFamily:'var(--mono)',display:'flex',alignItems:'center',gap:5 }}>
        <span style={{ animation:'blink 1.5s infinite',display:'inline-block' }}>●</span> LIVE EVENTS
      </span>
      {events.slice(-14).reverse().map((e,i)=>(
        <div key={i} style={{ fontSize:9,whiteSpace:'nowrap',padding:'3px 9px',borderRadius:5,background:`${TYPE_COL[e.event_type]??'#888'}12`,border:`1px solid ${TYPE_COL[e.event_type]??'#888'}30`,color:TYPE_COL[e.event_type]??'#888',fontFamily:'var(--mono)',transition:'all 0.2s' }}>
          {e.event_type.replace('_',' ')} {e.zone_name?`@ ${e.zone_name}`:''}{e.gender?` · ${e.gender}`:''}
        </div>
      ))}
    </div>
  )
}

function Reveal({ children,delay=0,direction='up' }:{ children:ReactNode;delay?:number;direction?:'up'|'left'|'right' }) {
  const { ref,visible } = useReveal()
  const tx=direction==='left'?'-30px':direction==='right'?'30px':'0'
  const ty=direction==='up'?'28px':'0'
  return (
    <div ref={ref} style={{ opacity:visible?1:0,transform:visible?'none':`translate(${tx},${ty})`,transition:`opacity 0.6s ${delay}ms, transform 0.65s ${delay}ms cubic-bezier(0.16,1,0.3,1)` }}>
      {children}
    </div>
  )
}

function Card({ children,accent,dark,style={} }:{ children:ReactNode;accent?:string;dark:boolean;style?:any }) {
  return (
    <div style={{
      background: dark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.92)',
      border: `1px solid ${dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.09)'}`,
      borderRadius:16,padding:22,minHeight:'fit-content',overflow:'visible',
      backdropFilter:'blur(16px)',
      boxShadow: dark ? '0 2px 20px rgba(0,0,0,0.2)' : '0 2px 20px rgba(0,0,0,0.06)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionHead({ children,accent,dark }:{ children:ReactNode;accent:string;dark:boolean }) {
  return (
    <div style={{ fontFamily:'var(--display)',fontSize:11,fontWeight:800,letterSpacing:2.5,color:accent,marginBottom:14,display:'flex',alignItems:'center',gap:7,textTransform:'uppercase' }}>
      {children}
    </div>
  )
}

// ── LANDING PAGE ───────────────────────────────────────────────────────────────
function LandingPage({ onEnter,dark,toggleDark }:{ onEnter:()=>void; dark:boolean; toggleDark:()=>void }) {
  const [tick,setTick] = useState(0)
  useEffect(()=>{ const t=setInterval(()=>setTick(p=>p+1),80); return()=>clearInterval(t) },[])

  const stats=[
    { n:'1,248',label:'Customers Tracked' },{ n:'96%',label:'YOLO Accuracy' },
    { n:'4',label:'Live Camera Feeds' },{ n:'<2s',label:'Detection Latency' },
  ]
  const features=[
    { icon:'🔥',title:'Live Heatmaps',desc:'Real-time zone intensity overlaid on store layout with animated person tracking' },
    { icon:'🎥',title:'YOLO CCTV',desc:'YOLOv8 + ByteTrack labels every person — Customer-F, Customer-M, Staff — with confidence scores' },
    { icon:'⚡',title:'Dual Store Compare',desc:'Side-by-side heatmap and KPI comparison between Store 1 and Store 2' },
    { icon:'📊',title:'Deep Analytics',desc:'Conversion funnel, hourly footfall, gender split, top brands, anomaly alerts' },
    { icon:'🤖',title:'AI Anomaly Engine',desc:'Queue spike detection, dead zone alerts, high-traffic warnings with action suggestions' },
    { icon:'📡',title:'Live Event Stream',desc:'Real-time ENTER/EXIT/DWELL/QUEUE events streamed via WebSocket' },
  ]

  return (
    <div style={{ minHeight:'100vh',overflow:'auto',position:'relative' }}>
      <div style={{ position:'fixed',inset:0,backgroundImage:`linear-gradient(${dark?'rgba(0,255,200,0.025)':'rgba(0,180,140,0.04)'} 1px,transparent 1px),linear-gradient(90deg,${dark?'rgba(0,255,200,0.025)':'rgba(0,180,140,0.04)'} 1px,transparent 1px)`,backgroundSize:'56px 56px',pointerEvents:'none',zIndex:0 }} />
      <div style={{ position:'fixed',inset:0,background:`radial-gradient(ellipse 80% 60% at 50% -10%,${dark?'rgba(0,255,200,0.09)':'rgba(0,180,140,0.08)'},transparent)`,pointerEvents:'none',zIndex:0 }} />

      {[...Array(16)].map((_,i)=>(
        <div key={i} style={{ position:'fixed',left:`${5+i*6}%`,top:`${10+((i*37)%80)}%`,width:i%3===0?3:2,height:i%3===0?3:2,borderRadius:'50%',background:'var(--accent1)',opacity:dark?0.2:0.12,animation:`float${i%3} ${3+i*0.35}s ease-in-out infinite alternate`,pointerEvents:'none',zIndex:0 }} />
      ))}

      <div style={{ position:'relative',zIndex:1,maxWidth:1200,margin:'0 auto',padding:'0 32px' }}>
        <nav style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'24px 0',borderBottom:`1px solid ${dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.08)'}` }}>
          <div style={{ display:'flex',alignItems:'center',gap:11 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,var(--accent1),var(--accent2))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:900,color:'#000',fontFamily:'var(--display)',boxShadow:'0 0 20px rgba(0,255,200,0.3)' }}>V</div>
            <div>
              <div style={{ fontFamily:'var(--display)',fontWeight:900,fontSize:17,letterSpacing:0.5 }}>VEYRA <span style={{ color:'var(--accent1)' }}>AI</span></div>
              <div style={{ fontSize:8,color: dark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.4)',letterSpacing:3,fontFamily:'var(--mono)' }}>VISION OS v3</div>
            </div>
          </div>
          <div style={{ display:'flex',gap:14,alignItems:'center' }}>
            <div style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 14px',background:dark?'rgba(0,255,200,0.08)':'rgba(0,180,140,0.08)',border:'1px solid rgba(0,255,200,0.25)',borderRadius:20 }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent1)',animation:'blink 1.5s infinite',boxShadow:'0 0 6px var(--accent1)' }} />
              <span style={{ fontSize:10,color:'var(--accent1)',fontFamily:'var(--mono)',letterSpacing:1,fontWeight:600 }}>AI LIVE</span>
            </div>
          </div>
        </nav>

        <section style={{ paddingTop:90,paddingBottom:80,textAlign:'center' }}>
          <Reveal>
            <div style={{ display:'inline-block',background:`rgba(0,255,200,${dark?'0.07':'0.09'})`,border:'1px solid rgba(0,255,200,0.22)',borderRadius:24,padding:'5px 18px',fontSize:10,color:'var(--accent1)',letterSpacing:3.5,fontFamily:'var(--mono)',marginBottom:26,backdropFilter:'blur(8px)' }}>
              ● AUTONOMOUS RETAIL INTELLIGENCE PLATFORM
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 style={{ fontFamily:'var(--display)',fontWeight:900,fontSize:'clamp(52px,9vw,104px)',letterSpacing:-4,lineHeight:0.92,marginBottom:26 }}>
              VEYRA AI<br/>
              <span style={{ color:'transparent',WebkitTextStroke:`1px ${dark?'rgba(0,255,200,0.3)':'rgba(0,160,120,0.35)'}`,fontSize:'0.62em' }}>VISION OS</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p style={{ fontFamily:'var(--body)',fontSize:17,color: dark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)',maxWidth:520,margin:'0 auto 44px',lineHeight:1.75 }}>
              Real-time retail intelligence powered by YOLOv8. Live heatmaps, person tracking, CCTV analytics, and AI-driven insights for every store.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <button onClick={onEnter}
              style={{ background:'linear-gradient(135deg,var(--accent1),#00b890)',color:'#000',fontFamily:'var(--display)',fontWeight:900,fontSize:15,padding:'16px 44px',borderRadius:14,border:'none',cursor:'pointer',letterSpacing:0.5,boxShadow:'0 0 50px rgba(0,255,200,0.35),0 8px 30px rgba(0,0,0,0.2)',transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.2s' }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.06)'; e.currentTarget.style.boxShadow='0 0 70px rgba(0,255,200,0.45),0 12px 40px rgba(0,0,0,0.25)' }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 0 50px rgba(0,255,200,0.35),0 8px 30px rgba(0,0,0,0.2)' }}>
              ENTER COMMAND CENTER →
            </button>
          </Reveal>
        </section>

        <Reveal delay={80}>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,borderRadius:18,overflow:'hidden',border:`1px solid ${dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.09)'}`,marginBottom:90,backdropFilter:'blur(16px)' }}>
            {stats.map((s,i)=>(
              <div key={i} style={{ padding:'26px 22px',background:dark?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.88)',textAlign:'center',borderRight:i<3?`1px solid ${dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)'}`:''  }}>
                <div style={{ fontFamily:'var(--display)',fontSize:36,fontWeight:900,color:'var(--accent1)',letterSpacing:-2,lineHeight:1 }}>{s.n}</div>
                <div style={{ fontFamily:'var(--mono)',fontSize:10,color: dark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.45)',letterSpacing:1,marginTop:6,textTransform:'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>

        <section style={{ marginBottom:90 }}>
          <Reveal>
            <div style={{ textAlign:'center',marginBottom:52 }}>
              <h2 style={{ fontFamily:'var(--display)',fontSize:40,fontWeight:900,letterSpacing:-1.5,marginBottom:10 }}>Platform Capabilities</h2>
              <p style={{ color: dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.45)',fontSize:15,fontFamily:'var(--body)' }}>Everything you need to understand your store in real time</p>
            </div>
          </Reveal>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16 }}>
            {features.map((f,i)=>(
              <Reveal key={i} delay={i*80} direction={i%2===0?'left':'right'}>
                <div style={{ background:dark?'rgba(255,255,255,0.025)':'rgba(255,255,255,0.88)',border:`1px solid ${dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.08)'}`,borderRadius:18,padding:'26px 24px',transition:'border-color 0.3s,transform 0.35s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.3s',cursor:'default',backdropFilter:'blur(16px)' }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(0,255,200,0.28)'; e.currentTarget.style.transform='translateY(-6px)'; e.currentTarget.style.boxShadow='0 16px 40px rgba(0,255,200,0.08)' }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.08)'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
                  <div style={{ fontSize:30,marginBottom:14 }}>{f.icon}</div>
                  <div style={{ fontFamily:'var(--display)',fontSize:16,fontWeight:800,marginBottom:9 }}>{f.title}</div>
                  <div style={{ fontFamily:'var(--body)',fontSize:13,color: dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.5)',lineHeight:1.65 }}>{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section style={{ marginBottom:90 }}>
          <Reveal>
            <h2 style={{ fontFamily:'var(--display)',fontSize:30,fontWeight:900,textAlign:'center',marginBottom:36 }}>🧠 AI Pipeline</h2>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:0,flexWrap:'wrap' }}>
              {['CCTV Feed','YOLOv8 Detection','ByteTrack','Zone Classifier','FastAPI WS','React Dashboard'].map((s,i)=>(
                <div key={i} style={{ display:'flex',alignItems:'center' }}>
                  <div style={{ background:dark?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',border:`1px solid ${dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.09)'}`,borderRadius:12,padding:'11px 18px',fontSize:11,fontFamily:'var(--mono)',color: dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.5)',transition:'border-color 0.25s,color 0.25s,background 0.25s',backdropFilter:'blur(12px)' }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent1)'; e.currentTarget.style.color='var(--accent1)'; e.currentTarget.style.background=dark?'rgba(0,255,200,0.06)':'rgba(0,255,200,0.08)' }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor=dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.09)'; e.currentTarget.style.color=dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.5)'; e.currentTarget.style.background=dark?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)' }}>
                    {s}
                  </div>
                  {i<5 && <div style={{ width:28,height:1,background:`linear-gradient(90deg,${dark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.1)'},rgba(0,255,200,0.4))`,position:'relative' }}>
                    <div style={{ position:'absolute',right:-4,top:-4,color:'var(--accent1)',fontSize:10,opacity:0.6 }}>▶</div>
                  </div>}
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <section style={{ textAlign:'center',paddingBottom:90 }}>
          <Reveal>
            <div style={{ background:dark?'rgba(255,255,255,0.025)':'rgba(255,255,255,0.88)',border:'1.5px solid rgba(0,255,200,0.2)',borderRadius:22,padding:'52px 44px',backdropFilter:'blur(20px)',boxShadow:'0 0 60px rgba(0,255,200,0.05)' }}>
              <h2 style={{ fontFamily:'var(--display)',fontSize:36,fontWeight:900,marginBottom:14,letterSpacing:-1 }}>Ready to see your store?</h2>
              <p style={{ color: dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.45)',fontSize:15,marginBottom:30,fontFamily:'var(--body)' }}>Live data. Real-time tracking. Full AI intelligence.</p>
              <button onClick={onEnter}
                style={{ background:'transparent',color:'var(--accent1)',fontFamily:'var(--display)',fontWeight:900,fontSize:15,padding:'14px 40px',borderRadius:14,border:'2px solid var(--accent1)',cursor:'pointer',transition:'all 0.25s',letterSpacing:0.3 }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(0,255,200,0.1)'; e.currentTarget.style.boxShadow='0 0 30px rgba(0,255,200,0.15)' }}
                onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.boxShadow='none' }}>
                OPEN DASHBOARD →
              </button>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  )
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
type NavPage = 'dashboard' | 'cameras' | 'analytics' | 'events'

function Dashboard({ dark, toggleDark }: { dark: boolean; toggleDark: () => void }) {
  const [storeIdx,setStoreIdx] = useState(0)
  const [page,setPage] = useState<NavPage>('dashboard')
  const [wsState,setWsState] = useState<Record<string,any>>({})
  const [liveEvents,setLiveEvents] = useState<LiveEvent[]>([])
  const [compareOpen,setCompareOpen] = useState(false)
  const [compareData,setCompareData] = useState<{ST1008:Zone[],ST1076:Zone[]}|null>(null)
  const [connected,setConnected] = useState(false)
  const [activeTime,setActiveTime] = useState('')
  const [sidebarCollapsed,setSidebarCollapsed] = useState(false)
  const [downloading,setDownloading] = useState(false)
const downloadingRef = useRef(false)
const lastDownloadRef = useRef<number>(0)

  const store=STORES[storeIdx]
  const metrics=useApi<Metrics>(`/stores/${store.id}/metrics`,3500)
  const anomalies=useApi<{anomalies:Anomaly[]}>(`/stores/${store.id}/anomalies`,8000)
  const funnel=useApi<{stages:FunnelStage[]}>(`/stores/${store.id}/funnel`,5000)
  const aiManager=useApi<any>(`/stores/${store.id}/ai-manager`,6000)

  // VEYRA FIX: prevent empty AI cards while API refreshes
  const aiInsights = aiManager?.insights ?? []
  const handoffs=useApi<any>(`/stores/${store.id}/handoffs`,6000)

  useEffect(()=>{
    const t=setInterval(()=>setActiveTime(new Date().toLocaleTimeString('en-IN',{hour12:false})),1000)
    return()=>clearInterval(t)
  },[])

  useEffect(()=>{
    let ws:WebSocket; let retry:any
    const connect=()=>{
      ws=new WebSocket(WS)
      ws.onopen=()=>setConnected(true)
      ws.onclose=()=>{ setConnected(false); retry=setTimeout(connect,3000) }
      ws.onerror=()=>ws.close()
      ws.onmessage=msg=>{
        try {
          const d=JSON.parse(msg.data)
          if(d.type==='init') {
            setWsState(prev=>({...prev,...Object.fromEntries(['ST1008','ST1076'].map(sid=>[sid,{zones:d.zones?.[sid]??[],persons:d.persons?.[sid]??[],yolo:[]}]))}))
          } else if(d.type==='state') {
            setWsState(prev=>{
              const prevZones=prev[d.store_id]?.zones??[]
              const newZones=(d.zones??prevZones).map((z:any)=>{
                const old=prevZones.find((p:any)=>p.id===z.id)
                return {...z,intensity:z.intensity??old?.intensity??0,visits:z.visits??old?.visits??0,avg_dwell_s:z.avg_dwell_s??old?.avg_dwell_s??0}
              })
              return {...prev,[d.store_id]:{zones:newZones,persons:d.persons??[],yolo:d.yolo_detections??[]}}
            })
            if(d.latest_event) setLiveEvents(prev=>[...prev.slice(-60),d.latest_event])
          }
        } catch {}
      }
    }
    connect()
    return()=>{ clearTimeout(retry); ws?.close() }
  },[])

  const cur=wsState[store.id]??{zones:[],persons:[],yolo:[]}

  const openCompare=async()=>{
    const [h1,h2]=await Promise.all([
      fetch(`${API}/stores/ST1008/heatmap`).then(r=>r.json()),
      fetch(`${API}/stores/ST1076/heatmap`).then(r=>r.json()),
    ])
    setCompareData({ST1008:h1.zones,ST1076:h2.zones})
    setCompareOpen(true)
  }

  const handleDownloadReport = async () => {
    const now = Date.now()
    const bust = '_t=' + now + '&_r=' + Math.random().toString(36).slice(2)
    const url = 'http://localhost:8000/stores/' + store.id + '/report?' + bust
    setDownloading(true)
    try {
      const response = await fetch(url, { method: 'GET', cache: 'no-store' })
      if (!response.ok) throw new Error('Server error ' + response.status)
      const blob = await response.blob()
      if (blob.size === 0) throw new Error('Empty PDF')
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'VEYRA_Report_' + store.id + '_' + now + '.pdf'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000)
    } catch (err) {
      alert('Download failed: ' + err)
    } finally {
      setDownloading(false)
    }
  }

  

  const navItems:[NavPage,string,string,number?][] = [
    ['dashboard','⬡','Live Dashboard'],
    ['cameras','◉','Camera Feeds',store.cams.length],
    ['analytics','◈','Deep Analytics'],
    ['events','◎','Live Events',liveEvents.length],
    ['dashboard','🤖','AI Intelligence'],
  ]

  const hourlyData=(metrics?.hourly_traffic??[]).map((v,i)=>({h:`${i}h`,v}))
  const genderData=[
    {name:'Female',value:metrics?.gender_split?.F??0,fill:'#ff4fa3'},
    {name:'Male',value:metrics?.gender_split?.M??0,fill:'#00e5a0'},
  ]

  const sideW = sidebarCollapsed ? 64 : 214

  return (
    <div style={{ display:'flex',height:'100vh',overflow:'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{ width:sideW,flexShrink:0,borderRight:`1px solid ${dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.08)'}`,display:'flex',flexDirection:'column',background:dark?'rgba(4,8,16,0.97)':'rgba(218,226,240,0.95)',backdropFilter:'blur(24px)',transition:'width 0.3s cubic-bezier(0.4,0,0.2,1)',overflow:'hidden',position:'relative',zIndex:10 }}>
        <div style={{ padding:'18px 16px 14px',borderBottom:`1px solid ${dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.07)'}`,display:'flex',alignItems:'center',gap:9,justifyContent:sidebarCollapsed?'center':'flex-start' }}>
          <div style={{ width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,var(--accent1),var(--accent2))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:900,color:'#000',fontFamily:'var(--display)',flexShrink:0,boxShadow:'0 0 14px rgba(0,255,200,0.25)' }}>V</div>
          {!sidebarCollapsed && (
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:'var(--display)',fontSize:14,fontWeight:900,letterSpacing:0.5,whiteSpace:'nowrap' }}>VEYRA <span style={{ color:'var(--accent1)' }}>AI</span></div>
              <div style={{ fontSize:7.5,color: dark?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.35)',letterSpacing:2.5,fontFamily:'var(--mono)',marginTop:1 }}>VISION OS</div>
            </div>
          )}
        </div>

        <button onClick={()=>setSidebarCollapsed(c=>!c)} style={{ position:'absolute',top:20,right:-12,width:24,height:24,borderRadius:'50%',background:dark?'#0d1524':'#e8eeff',border:`1px solid ${dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.12)'}`,cursor:'pointer',fontSize:10,color:dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s',zIndex:20 }}>
          {sidebarCollapsed?'›':'‹'}
        </button>

        <nav style={{ padding:'12px 8px',flex:1,overflowY:'auto' }}>
          {!sidebarCollapsed && <div style={{ fontSize:8.5,color: dark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.3)',letterSpacing:2.5,fontFamily:'var(--mono)',padding:'0 8px',marginBottom:8,textTransform:'uppercase' }}>Navigation</div>}
          {navItems.map(([id,icon,label,badge])=>(
            <button key={id} onClick={()=>setPage(id)} title={sidebarCollapsed?label:''}
              style={{ width:'100%',display:'flex',alignItems:'center',gap:9,padding:sidebarCollapsed?'10px':'9px 10px',borderRadius:10,border:'none',background:page===id?(dark?'rgba(0,255,200,0.1)':'rgba(0,200,160,0.1)'):'transparent',color:page===id?'var(--accent1)':(dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.5)'),fontFamily:'var(--body)',fontSize:12,cursor:'pointer',transition:'all 0.2s',marginBottom:3,textAlign:'left',justifyContent:sidebarCollapsed?'center':'space-between',borderLeft:page===id?`2px solid var(--accent1)`:'2px solid transparent' }}>
              <span style={{ display:'flex',alignItems:'center',gap:9 }}>
                <span style={{ fontSize:15,opacity:page===id?1:0.45,flexShrink:0 }}>{icon}</span>
                {!sidebarCollapsed && label}
              </span>
              {!sidebarCollapsed && badge !== undefined && (
                <span style={{ fontSize:9,background:page===id?'var(--accent1)':'rgba(255,255,255,0.08)',color:page===id?'#000':'rgba(255,255,255,0.4)',borderRadius:10,padding:'1px 7px',fontFamily:'var(--mono)',flexShrink:0 }}>{badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding:'10px 8px',borderTop:`1px solid ${dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.07)'}` }}>
          {!sidebarCollapsed && <div style={{ fontSize:8.5,color: dark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.3)',letterSpacing:2.5,fontFamily:'var(--mono)',padding:'0 8px',marginBottom:8,textTransform:'uppercase' }}>Active Store</div>}
          {STORES.map((s,i)=>(
            <button key={s.id} onClick={()=>setStoreIdx(i)} title={sidebarCollapsed?s.id:''}
              style={{ width:'100%',display:'flex',alignItems:'center',gap:8,padding:sidebarCollapsed?'9px':'8px 10px',borderRadius:9,border:`1px solid ${storeIdx===i?s.color+'40':'transparent'}`,background:storeIdx===i?`${s.color}0e`:'transparent',color:storeIdx===i?s.color:(dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.45)'),fontFamily:'var(--mono)',fontSize:10,cursor:'pointer',transition:'all 0.2s',marginBottom:4,textAlign:'left',justifyContent:sidebarCollapsed?'center':'flex-start' }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:storeIdx===i?s.color:(dark?'#333':'#ccc'),flexShrink:0 }} />
              {!sidebarCollapsed && (
                <div>
                  <div style={{ fontWeight:700 }}>{s.id}</div>
                  <div style={{ fontSize:8,opacity:0.55 }}>{s.city}</div>
                </div>
              )}
            </button>
          ))}
          <div style={{ marginTop:8,display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:9,background:connected?(dark?'rgba(0,229,160,0.07)':'rgba(0,180,130,0.07)'):(dark?'rgba(255,50,80,0.07)':'rgba(255,50,80,0.07)'),border:`1px solid ${connected?'rgba(0,229,160,0.2)':'rgba(255,50,80,0.2)'}`,justifyContent:sidebarCollapsed?'center':'flex-start' }}>
            <div style={{ width:5,height:5,borderRadius:'50%',background:connected?'#00e5a0':'#ff3250',animation:'blink 1.5s infinite',flexShrink:0 }} />
            {!sidebarCollapsed && <span style={{ fontSize:9,color:connected?'#00e5a0':'#ff3250',fontFamily:'var(--mono)' }}>{connected?'SSE LIVE':'OFFLINE'}</span>}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
        {/* Topbar */}
        <header style={{ padding:'11px 24px',borderBottom:`1px solid ${dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.08)'}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:dark?'rgba(4,8,16,0.97)':'rgba(218,226,240,0.95)',backdropFilter:'blur(20px)',flexShrink:0,zIndex:9 }}>
          <div>
            <div style={{ fontFamily:'var(--display)',fontSize:18,fontWeight:900,letterSpacing:-0.4 }}>
              {navItems.find(n=>n[0]===page)?.[2]}
            </div>
            <div style={{ fontSize:10,color: dark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.4)',fontFamily:'var(--mono)',marginTop:1 }}>
              ⚡ VEYRA AI COMMAND CORE · {store.id} — {store.city} · YOLO ACTIVE
            </div>
          </div>
          <div style={{ display:'flex',gap:10,alignItems:'center' }}>

            {/* ── DOWNLOAD BUTTON — triggers fresh StreamingResponse every click ── */}
            <button
              onClick={handleDownloadReport}
              disabled={downloading}
              style={{
                background: downloading
                  ? (dark ? 'rgba(80,80,80,0.4)' : 'rgba(180,180,180,0.4)')
                  : 'linear-gradient(135deg,#00ffc8,#7c3aed)',
                border: 'none',
                color: downloading ? (dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)') : '#fff',
                padding: '8px 16px',
                borderRadius: 10,
                cursor: downloading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--display)',
                fontSize: 11,
                fontWeight: 800,
                boxShadow: downloading ? 'none' : '0 4px 16px rgba(0,255,200,0.2)',
                transition: 'all 0.2s',
                opacity: downloading ? 0.6 : 1,
                minWidth: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onMouseEnter={e=>{
                if (!downloading) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,255,200,0.3)'
                }
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = downloading ? 'none' : '0 4px 16px rgba(0,255,200,0.2)'
              }}
            >
              {downloading ? (
                <>
                  <span style={{ display:'inline-block',animation:'blink 0.8s infinite' }}>⏳</span>
                  Generating Report…
                </>
              ) : (
                <>📄 Download AI Executive Report</>
              )}
            </button>

            <button onClick={openCompare}
              style={{ background:dark?'rgba(255,107,53,0.1)':'rgba(255,107,53,0.08)',border:'1px solid rgba(255,107,53,0.3)',color:'#ff6b35',padding:'8px 16px',borderRadius:10,cursor:'pointer',fontFamily:'var(--display)',fontSize:11,fontWeight:700,transition:'all 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,107,53,0.18)'}
              onMouseLeave={e=>e.currentTarget.style.background=dark?'rgba(255,107,53,0.1)':'rgba(255,107,53,0.08)'}>
              ⚡ Compare
            </button>
            <div style={{ fontFamily:'var(--mono)',fontSize:12,color:dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.45)',background:dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)',padding:'6px 12px',borderRadius:9,border:`1px solid ${dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.08)'}`,letterSpacing:0.5 }}>{activeTime}</div>
          </div>
        </header>

        {/* Page */}
        <div style={{
          flex:1,
          overflowY:'auto',
          padding:'20px 24px',
          background:dark
          ? 'radial-gradient(circle at 20% 0%,rgba(0,255,200,.12),transparent 35%),linear-gradient(135deg,#020617,#070b16)'
          : 'linear-gradient(135deg,#dce5f3,#f8fafc)'
        }}>

          
          
          {page==='dashboard' && (

<div
style={{
display:'grid',
gridTemplateColumns:'1fr 1fr',
gap:20,
marginBottom:18
}}
>


{/* AI THINKING */}
<Reveal>

<Card
dark={dark}
style={{
minHeight:260,
border:'1px solid rgba(0,255,200,.25)'
}}
>

<SectionHead
accent="#00ffc8"
dark={dark}
>
🧠 VEYRA AI THINKING
</SectionHead>


<div style={{marginBottom:15}}>
Autonomous Retail Decision Engine Active
</div>


{aiManager?.insights?.map(
(i:any,k:number)=>(

<div
key={k}
style={{
padding:12,
marginBottom:10,
borderRadius:12,
background:'rgba(0,255,200,.08)'
}}
>

<b>{i.title}</b>

<p>
{i.business_impact}
</p>

<p style={{color:'#00ffc8'}}>
⚡ {i.recommendation}
</p>

<small>
AI Confidence {i.confidence}%
</small>


</div>

)
)}


</Card>

</Reveal>




{/* STORE MANAGER */}
<Reveal>

<Card
dark={dark}
style={{
minHeight:260,
border:'1px solid rgba(167,139,250,.35)'
}}
>


<SectionHead
accent="#a78bfa"
dark={dark}
>

🤖 VEYRA AI STORE MANAGER

</SectionHead>



{aiManager?.insights?.map(
(i:any,k:number)=>(

<div
key={k}
style={{
padding:12,
marginBottom:10,
borderRadius:12,
border:'1px solid rgba(255,255,255,.1)'
}}
>


<div
style={{
display:'flex',
justifyContent:'space-between'
}}
>

<b>{i.category}</b>

<span>
{i.severity}
</span>

</div>


<p>{i.title}</p>


<div
style={{
color:'#a78bfa'
}}
>
{i.recommendation}
</div>


</div>

)
)}



</Card>

</Reveal>


</div>

)}
          {page==='dashboard' && (

<Reveal>

<Card
dark={dark}
style={{

marginBottom:18,

border:'1px solid rgba(167,139,250,.35)'

}}

>


<SectionHead
accent="#a78bfa"
dark={dark}
>

🧬 DEEP REID CAMERA JOURNEY

</SectionHead>


{handoffs?.handoffs?.length ?

<div

style={{

display:"grid",

gridTemplateColumns:"repeat(2,1fr)",

gap:12

}}

>


{handoffs.handoffs
.slice(0,6)
.map((h:any,k:number)=>(


<div

key={k}

style={{

padding:12,

border:'1px solid rgba(124,58,237,.5)',

borderRadius:14,

background:'rgba(124,58,237,.12)',

fontSize:13

}}

>


{/* HEADER */}

<div

style={{

display:'flex',

justifyContent:'space-between',

alignItems:'center'

}}

>


<b>

🧍 {h.visitor_id}

</b>


<span

style={{

color:"#00ffc8",

fontSize:12

}}

>

{h.journey_type}

</span>


</div>




{/* CAMERA PATH */}

<div

style={{

marginTop:8,

color:'#38c4ff',

fontFamily:'var(--mono)',

fontSize:12

}}

>


{

(h.journey || [])

.map(

(c:any)=>

typeof c==='string'

? c

: c.camera

)

.join(' → ')

}


</div>




{/* STATS */}


<div

style={{

marginTop:8,

color:"#a78bfa",

lineHeight:1.7

}}

>


✓ {

h.cameras_connected ||

h.journey?.length

} Cameras


<br/>


✓ {h.handoffs} Handoffs


<br/>


✓ {

Math.round(

(

h.confidence ||

h.match_confidence ||

0.95

)

*100

)

}% Confidence


</div>


</div>


))}


</div>


:


<div

style={{

color:'#777'

}}

>

Waiting for ReID handoff events...

</div>


}


</Card>

</Reveal>

)}

          {page==='dashboard' && (
            <div>
              <Reveal>
                <Card dark={dark} style={{marginBottom:18,border:'1px solid rgba(0,255,200,.25)'}}>
                  <SectionHead accent="#00ffc8" dark={dark}>🧠 VEYRA AI COMMAND CENTER</SectionHead>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
                    <div>
                      <small>Current AI Decision</small>
                      <h3 style={{color:'#00ffc8'}}>{aiManager?.insights?.[0]?.recommendation || 'Optimizing staff allocation using live CCTV intelligence'}</h3>
                    </div>
                    <div>
                      <small>Decision Confidence</small>
                      <h1 style={{color:'#38c4ff'}}>{aiManager?.insights?.[0]?.confidence || 97}%</h1>
                    </div>
                    <div>
                      <small>AI Engine</small>
                      <h3 style={{color:'#a78bfa'}}>REAL TIME ACTIVE</h3>
                    </div>
                  </div>
                </Card>
              </Reveal>

              <Reveal>
                <div style={{ background:dark?'linear-gradient(135deg,rgba(0,255,200,0.05),rgba(255,107,53,0.05))':'linear-gradient(135deg,rgba(0,200,160,0.06),rgba(255,107,53,0.06))',border:`1px solid ${dark?'rgba(0,255,200,0.1)':'rgba(0,200,160,0.15)'}`,borderRadius:16,padding:'20px 24px',marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center',backdropFilter:'blur(12px)' }}>
                  <div>
                    <div style={{ fontFamily:'var(--display)',fontSize:11,letterSpacing:3,color:'var(--accent1)',marginBottom:6 }}>● VEYRA AI — THE ULTIMATE VISION OS</div>
                    <div style={{ fontFamily:'var(--display)',fontSize:22,fontWeight:900,letterSpacing:-0.5 }}>Real Time Retail Intelligence powered by YOLOv8</div>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 16px',background:'rgba(0,255,200,0.09)',borderRadius:10,border:'1px solid rgba(0,255,200,0.22)' }}>
                    <div style={{ width:7,height:7,borderRadius:'50%',background:'var(--accent1)',animation:'blink 1s infinite',boxShadow:'0 0 8px var(--accent1)' }} />
                    <span style={{ fontFamily:'var(--mono)',fontSize:10,color:'var(--accent1)',fontWeight:700,letterSpacing:1 }}>AI LIVE</span>
                  </div>
                </div>
              </Reveal>

              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:12,marginBottom:20 }}>
                <KpiCard dark={dark} value={wsState[store.id]?.persons?.length??metrics?.current_in_store??0} label="In Store Now" icon="👥" accent="var(--accent1)" sublabel="Live count" />
                <KpiCard dark={dark} value={metrics?.unique_visitors??0} label="Customers Today" icon="🆔" accent="#a78bfa" sublabel="Unique visitors" />
                <KpiCard dark={dark} value={metrics?.purchases??0} label="Purchases" icon="🛒" accent="#00e5a0" sublabel="Transactions" />
                <KpiCard dark={dark} value={Math.round(metrics?.conversion_rate??0)} label="Conversion" icon="📊" accent="#fbbf24" suffix="%" sublabel="Entry→Purchase" />
                <KpiCard dark={dark} value={Math.round(metrics?.revenue_today??0)} label="Revenue ₹" icon="💰" accent="#ff6b35" sublabel="Today total" />
                <KpiCard dark={dark} value={metrics?.store_health_score??0} label="Health Score" icon="❤️" accent="#38c4ff" suffix="/100" sublabel="AI assessment" />
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 410px',gap:16,marginBottom:20 }}>
                <Reveal direction="left">
                  <Card dark={dark} style={{ padding:0,overflow:'hidden' }}>
                    <div style={{ padding:'12px 18px',borderBottom:`1px solid ${dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)'}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                      <SectionHead accent="var(--accent1)" dark={dark}>🔥 AI SPATIAL INTELLIGENCE ENGINE</SectionHead>
                      <span style={{ fontFamily:'var(--mono)',fontSize:9,color: dark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.35)' }}>LIVE · {cur.zones.length} zones</span>
                    </div>
                    <div style={{ padding:14 }}>
                      <LiveHeatmap dark={dark} zones={cur.zones} persons={cur.persons} layoutSrc={store.layout} accentColor={store.color} />
                    </div>
                  </Card>
                </Reveal>

                <Reveal direction="right">
                  <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                    <Card dark={dark}>
                      <SectionHead accent="var(--accent2)" dark={dark}>🤖 AI Store Manager Command Center</SectionHead>
                      {(anomalies?.anomalies??[]).slice(0,3).map((a,i)=>{
                        const col=a.severity==='CRITICAL'?'#ff3250':a.severity==='WARN'?'#fbbf24':'#38c4ff'
                        const icon=a.severity==='CRITICAL'?'🔴':a.severity==='WARN'?'🟡':'🔵'
                        return (
                          <div key={i} style={{ display:'flex',gap:9,marginBottom:9,padding:'9px 11px',background:`${col}0c`,borderRadius:10,border:`1px solid ${col}22`,transition:'background 0.2s' }}>
                            <span style={{ fontSize:12 }}>{icon}</span>
                            <div>
                              <div style={{ fontSize:11,color:dark?'rgba(255,255,255,0.8)':'rgba(0,0,0,0.75)',fontWeight:600,fontFamily:'var(--body)' }}>{a.message.slice(0,56)}{a.message.length>56?'…':''}</div>
                              <div style={{ fontSize:9,color:dark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.4)',marginTop:2,fontFamily:'var(--mono)' }}>{a.suggested_action.slice(0,72)}…</div>
                            </div>
                          </div>
                        )
                      })}
                    </Card>

                    <Card dark={dark}>
                      <SectionHead accent="#a78bfa" dark={dark}>🏪 Digital Store Twin</SectionHead>
                      {(funnel?.stages??[]).map((s,i)=>{
                        const col=['#00ffc8','#38c4ff','#fbbf24','#00e5a0'][i]
                        return (
                          <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,padding:'7px 11px',background:dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',borderRadius:8 }}>
                            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                              <div style={{ width:3,height:15,borderRadius:2,background:col }} />
                              <span style={{ fontFamily:'var(--body)',fontSize:11,color:dark?'rgba(255,255,255,0.55)':'rgba(0,0,0,0.55)' }}>{s.stage}</span>
                            </div>
                            <span style={{ fontFamily:'var(--mono)',fontSize:12,color:col,fontWeight:700 }}>{s.count}</span>
                          </div>
                        )
                      })}
                      <div style={{ marginTop:8,padding:'8px 11px',background:dark?'rgba(167,139,250,0.07)':'rgba(167,139,250,0.08)',borderRadius:9,display:'flex',justifyContent:'space-between' }}>
                        <span style={{ fontSize:11,color:dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)',fontFamily:'var(--mono)' }}>Intent Score</span>
                        <span style={{ fontSize:12,color:'#a78bfa',fontWeight:700,fontFamily:'var(--display)' }}>{metrics?.store_health_score??87}%</span>
                      </div>
                    </Card>

                    <Card dark={dark}>
                      <SectionHead accent="#fbbf24" dark={dark}>⏱ Checkout Queue</SectionHead>
                      <div style={{ display:'flex',alignItems:'baseline',gap:8,marginBottom:10 }}>
                        <span style={{ fontFamily:'var(--display)',fontSize:44,fontWeight:900,color:metrics?.queue_depth??0>4?'#ff3250':'#fbbf24',lineHeight:1 }}>{metrics?.queue_depth??0}</span>
                        <span style={{ fontSize:11,color:dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)',fontFamily:'var(--mono)' }}>in queue</span>
                      </div>
                      <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginBottom:10 }}>
                        {[...(Array(Math.max(metrics?.queue_depth??0,0)))].map((_,i)=>(
                          <div key={i} style={{ width:24,height:24,borderRadius:'50%',background:`hsl(${200-i*20},75%,${dark?60:50}%)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,boxShadow:`0 2px 8px hsl(${200-i*20},75%,60%)44` }}>🧑</div>
                        ))}
                      </div>
                      <div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:dark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.4)',fontFamily:'var(--mono)',marginBottom:5 }}>
                        <span>Queue Load</span>
                        <span style={{ color:metrics?.queue_depth??0>4?'#ff3250':'#00e5a0',fontWeight:700 }}>{Math.round((metrics?.queue_depth??0)/8*100)}%</span>
                      </div>
                      <div style={{ height:5,background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)',borderRadius:3 }}>
                        <div style={{ height:'100%',width:`${Math.round((metrics?.queue_depth??0)/8*100)}%`,background:metrics?.queue_depth??0>4?'#ff3250':'#00e5a0',borderRadius:3,transition:'width 0.6s' }} />
                      </div>
                    </Card>
                  </div>
                </Reveal>
              </div>

              <Reveal>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:10,marginBottom:20 }}>
                  {cur.zones.slice(0,8).map((z:Zone)=>(
                    <div key={z.id} style={{ background:dark?'rgba(255,255,255,0.025)':'rgba(255,255,255,0.92)',border:`1px solid ${heatBorder(z.intensity??0)}28`,borderRadius:13,padding:'13px 15px',transition:'all 0.25s',cursor:'default',backdropFilter:'blur(12px)' }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor=heatBorder(z.intensity??0)+'55'; e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 8px 24px ${heatBorder(z.intensity??0)}15` }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor=heatBorder(z.intensity??0)+'28'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
                      <div style={{ fontSize:10,color:dark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.4)',marginBottom:5,fontFamily:'var(--mono)' }}>{z.name}</div>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline' }}>
                        <span style={{ fontSize:26,fontWeight:900,color:heatBorder(z.intensity??0),fontFamily:'var(--display)' }}>{z.intensity??0}%</span>
                        <span style={{ fontSize:9,color:dark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.35)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:0.5 }}>{heatWord(z.intensity??0)}</span>
                      </div>
                      <div style={{ height:3,background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)',borderRadius:2,marginTop:7 }}>
                        <div style={{ height:'100%',width:`${z.intensity??0}%`,background:`linear-gradient(90deg,${heatBorder(z.intensity??0)}80,${heatBorder(z.intensity??0)})`,borderRadius:2,transition:'width 0.7s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          )}

          {/* ── CAMERAS ── */}
          {page==='cameras' && (
            <div>
              <Reveal>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
                  <div>
                    <div style={{ fontFamily:'var(--display)',fontSize:18,fontWeight:900,marginBottom:3 }}>{store.name} — {store.city}</div>
                    <div style={{ fontFamily:'var(--mono)',fontSize:10,color: dark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.4)' }}>{store.cams.length} cameras · YOLOv8 detection active</div>
                  </div>
                  <div style={{ display:'flex',gap:10,fontSize:11,fontFamily:'var(--mono)',background:dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.04)',padding:'8px 14px',borderRadius:10,border:`1px solid ${dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.08)'}` }}>
                    <span style={{ color:'#ff4fa3' }}>♀ Customer-F</span>
                    <span style={{ color:dark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.2)' }}>·</span>
                    <span style={{ color:'#00e5a0' }}>♂ Customer-M</span>
                    <span style={{ color:dark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.2)' }}>·</span>
                    <span style={{ color:'#38c4ff' }}>★ Staff</span>
                  </div>
                </div>
              </Reveal>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16 }}>
                {store.cams.map((cam,i)=>(
                  <Reveal key={cam.id} delay={i*80}>
                    <CamFeed dark={dark} cam={cam} detections={cur.yolo??[]} highlight={i===0} />
                  </Reveal>
                ))}
              </div>
              <Reveal delay={200}>
                <Card dark={dark} style={{ marginTop:16 }}>
                  <SectionHead accent="var(--accent1)" dark={dark}>🎯 Real-Time Detection Log</SectionHead>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8 }}>
                    {(cur.yolo??[]).map((d:YoloDet)=>{
                      const c=DET_COLOR[d.label]??'#fff'
                      return (
                        <div key={d.id} style={{ padding:'10px 14px',borderRadius:11,border:`1px solid ${c}22`,background:`${c}07`,transition:'border-color 0.2s,background 0.2s' }}
                          onMouseEnter={e=>{ e.currentTarget.style.borderColor=c+'40'; e.currentTarget.style.background=c+'0e' }}
                          onMouseLeave={e=>{ e.currentTarget.style.borderColor=c+'22'; e.currentTarget.style.background=c+'07' }}>
                          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                            <span style={{ color:c,fontSize:12,fontWeight:700,fontFamily:'var(--display)' }}>{DET_ICON[d.label]} {d.label}</span>
                            <span style={{ color:'#00e5a0',fontSize:10,fontFamily:'var(--mono)',fontWeight:700 }}>{Math.round(d.confidence*100)}%</span>
                          </div>
                          <div style={{ fontSize:10,color:dark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.4)',fontFamily:'var(--mono)' }}>📍 {d.section}</div>
                        </div>
                      )
                    })}
                    {(cur.yolo??[]).length===0 && <div style={{ color:dark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.35)',fontSize:11,fontFamily:'var(--mono)' }}>Awaiting detections…</div>}
                  </div>
                </Card>
              </Reveal>
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {page==='analytics' && metrics && (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(350px,1fr))',gap:16 }}>
              <Reveal direction="left">
                <Card dark={dark} style={{ gridColumn:'span 2' }}>
                  <SectionHead accent="var(--accent1)" dark={dark}>📈 Hourly Footfall</SectionHead>
                  <ResponsiveContainer width="100%" height={165}>
                    <AreaChart data={hourlyData}>
                      <defs>
                        <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent1)" stopOpacity={dark?0.3:0.2} />
                          <stop offset="95%" stopColor="var(--accent1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)'} />
                      <XAxis dataKey="h" tick={{ fill:dark?'#555':'#aaa',fontSize:9,fontFamily:'monospace' }} />
                      <YAxis tick={{ fill:dark?'#555':'#aaa',fontSize:9 }} />
                      <Tooltip contentStyle={{ background:dark?'#0a0e1a':'#fff',border:`1px solid ${dark?'#1e2535':'#e0e0e0'}`,borderRadius:10,fontSize:11,color:dark?'#e2e8f0':'#333' }} />
                      <Area type="monotone" dataKey="v" stroke="var(--accent1)" fill="url(#ag2)" strokeWidth={2.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Reveal>

              <Reveal>
                <Card dark={dark}>
                  <SectionHead accent="#ff4fa3" dark={dark}>👥 Gender Split</SectionHead>
                  <ResponsiveContainer width="100%" height={145}>
                    <PieChart>
                      <Pie data={genderData} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={5} dataKey="value">
                        {genderData.map((d,i)=><Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background:dark?'#0a0e1a':'#fff',border:`1px solid ${dark?'#1e2535':'#e0e0e0'}`,borderRadius:10,fontSize:11,color:dark?'#e2e8f0':'#333' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display:'flex',justifyContent:'center',gap:18,marginTop:6 }}>
                    {genderData.map(d=>(
                      <div key={d.name} style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,fontFamily:'var(--mono)' }}>
                        <div style={{ width:8,height:8,borderRadius:'50%',background:d.fill }} />
                        <span style={{ color:dark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.5)' }}>{d.name}: <strong style={{ color:d.fill }}>{d.value}</strong></span>
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>

              <Reveal direction="right">
                <Card dark={dark}>
                  <SectionHead accent="#fbbf24" dark={dark}>🏷 Top Brands</SectionHead>
                  {(metrics.top_brands??[]).map((b,i)=>(
                    <div key={b.name} style={{ marginBottom:11 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                        <span style={{ fontSize:11,color:dark?'rgba(255,255,255,0.55)':'rgba(0,0,0,0.55)',fontFamily:'var(--body)' }}>{b.name}</span>
                        <span style={{ fontSize:11,color:'#00e5a0',fontFamily:'var(--mono)',fontWeight:700 }}>₹{b.revenue.toLocaleString()}</span>
                      </div>
                      <div style={{ height:5,background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)',borderRadius:3 }}>
                        <div style={{ height:'100%',width:`${Math.min(100,(b.revenue/((metrics.top_brands?.[0]?.revenue??1)||1))*100)}%`,background:`linear-gradient(90deg,hsl(${160+i*25},70%,55%)88,hsl(${160+i*25},70%,55%))`,borderRadius:3,transition:'width 0.7s' }} />
                      </div>
                    </div>
                  ))}
                </Card>
              </Reveal>

              <Reveal>
                <Card dark={dark}>
                  <SectionHead accent="#a78bfa" dark={dark}>🔽 Conversion Funnel</SectionHead>
                  {(funnel?.stages??[]).map((s,i)=>(
                    <div key={s.stage} style={{ marginBottom:11 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                        <span style={{ fontSize:11,color:dark?'rgba(255,255,255,0.55)':'rgba(0,0,0,0.55)',fontFamily:'var(--body)' }}>{s.stage}</span>
                        <span style={{ fontSize:11,color:'var(--accent1)',fontFamily:'var(--mono)',fontWeight:700 }}>{s.count} <span style={{ color:dark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.35)' }}>({s.pct}%)</span></span>
                      </div>
                      <div style={{ height:5,background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)',borderRadius:3 }}>
                        <div style={{ height:'100%',width:`${s.pct}%`,background:`hsl(${195-i*35},70%,55%)`,borderRadius:3,transition:'width 0.8s' }} />
                      </div>
                    </div>
                  ))}
                </Card>
              </Reveal>

              <Reveal delay={100}>
                <Card dark={dark} style={{ gridColumn:'span 2' }}>
                  <SectionHead accent="#ff3250" dark={dark}>🚨 Active Anomalies</SectionHead>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:10 }}>
                    {(anomalies?.anomalies??[]).map((a,i)=>{
                      const c=a.severity==='CRITICAL'?'#ff3250':a.severity==='WARN'?'#fbbf24':'#38c4ff'
                      return (
                        <div key={i} style={{ padding:'13px 15px',borderRadius:12,border:`1px solid ${c}28`,background:`${c}07`,transition:'border-color 0.2s' }}
                          onMouseEnter={e=>e.currentTarget.style.borderColor=c+'45'}
                          onMouseLeave={e=>e.currentTarget.style.borderColor=c+'28'}>
                          <div style={{ display:'flex',gap:9,alignItems:'flex-start' }}>
                            <span style={{ fontSize:9,fontFamily:'var(--mono)',color:c,padding:'3px 7px',background:`${c}16`,borderRadius:5,marginTop:1,flexShrink:0,fontWeight:700,letterSpacing:0.5 }}>{a.severity}</span>
                            <div>
                              <div style={{ fontSize:12,color:dark?'rgba(255,255,255,0.8)':'rgba(0,0,0,0.75)',fontWeight:600,fontFamily:'var(--body)',marginBottom:4 }}>{a.message}</div>
                              <div style={{ fontSize:10,color:dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.45)',fontFamily:'var(--body)' }}>💡 {a.suggested_action}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </Reveal>
            </div>
          )}

          {/* ── EVENTS ── */}
          {page==='events' && (
            <div>
              <Reveal>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>
                  <Card dark={dark}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                      <SectionHead accent="var(--accent1)" dark={dark}>📡 Live CCTV Event Feed</SectionHead>
                      <span style={{ fontSize:9,color:'#38c4ff',fontFamily:'var(--mono)',background:'rgba(56,196,255,0.1)',padding:'3px 9px',borderRadius:5,letterSpacing:1 }}>STREAMING</span>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:4,maxHeight:400,overflowY:'auto' }}>
                      {liveEvents.slice(-20).reverse().map((e,i)=>{
                        const TYPE_COL: Record<string,string> = {entry:'#00e5a0',exit:'#ff4f4f',zone_entered:'#38c4ff',zone_exited:'#a78bfa',queue_completed:'#fbbf24',queue_abandoned:'#fb923c'}
                        const c=TYPE_COL[e.event_type]??'#888'
                        const typeLabel=e.event_type==='zone_entered'?'ENTER':e.event_type==='zone_exited'?'EXIT':e.event_type.replace('_',' ').toUpperCase()
                        return (
                          <div key={i} style={{ display:'flex',gap:10,alignItems:'center',padding:'9px 11px',borderRadius:9,background:dark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)',border:`1px solid ${dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)'}`,animation:i===0?'fadeIn 0.3s ease':'none',transition:'background 0.2s' }}
                            onMouseEnter={e=>e.currentTarget.style.background=dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)'}
                            onMouseLeave={e=>e.currentTarget.style.background=dark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)'}>
                            <span style={{ fontSize:9,fontFamily:'var(--mono)',color:c,background:`${c}16`,padding:'2px 8px',borderRadius:5,whiteSpace:'nowrap',minWidth:72,textAlign:'center',fontWeight:700,letterSpacing:0.5 }}>{typeLabel}</span>
                            <span style={{ fontSize:11,color:dark?'rgba(255,255,255,0.65)':'rgba(0,0,0,0.65)',fontFamily:'var(--body)',flex:1 }}>{e.zone_name??'Store'}{e.gender?` — ${e.gender}`:''}</span>
                            <span style={{ fontSize:9,color:dark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.35)',fontFamily:'var(--mono)',whiteSpace:'nowrap' }}>{new Date(e.timestamp).toLocaleTimeString('en-IN',{hour12:false})}</span>
                          </div>
                        )
                      })}
                    </div>
                  </Card>

                  <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                    <Card dark={dark} style={{ flex:1 }}>
                      <SectionHead accent="#fbbf24" dark={dark}>🔍 System Insights</SectionHead>
                      {(anomalies?.anomalies??[]).map((a,i)=>{
                        const c=a.severity==='CRITICAL'?'#ff3250':a.severity==='WARN'?'#fbbf24':'#38c4ff'
                        const icon=a.severity==='CRITICAL'?'🔴':a.severity==='WARN'?'🟡':'🔵'
                        return (
                          <div key={i} style={{ marginBottom:10,paddingBottom:10,borderBottom:i<(anomalies?.anomalies?.length??0)-1?`1px solid ${dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)'}`:'' }}>
                            <div style={{ display:'flex',gap:9,alignItems:'flex-start' }}>
                              <span style={{ fontSize:13 }}>{icon}</span>
                              <div>
                                <div style={{ fontSize:12,fontWeight:600,fontFamily:'var(--body)',marginBottom:3 }}>{a.type.replace(/_/g,' ')}</div>
                                <div style={{ fontSize:10,color:dark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.45)',fontFamily:'var(--body)' }}>{a.suggested_action}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </Card>

                    <Card dark={dark} style={{ border:'1.5px solid rgba(0,255,200,0.14)' }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
                        <SectionHead accent="var(--accent1)" dark={dark}>⚡ Live AI Stream</SectionHead>
                        <span style={{ fontSize:9,color:'#ff3250',fontFamily:'var(--mono)',background:'rgba(255,50,80,0.1)',padding:'3px 9px',borderRadius:5,letterSpacing:1,fontWeight:700 }}>REAL TIME</span>
                      </div>
                      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,marginBottom:8 }}>
                        {['Visitor','Event','Zone','Confidence'].map(h=>(
                          <div key={h} style={{ fontSize:9,color:dark?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.3)',fontFamily:'var(--mono)',letterSpacing:0.5,textTransform:'uppercase' }}>{h}</div>
                        ))}
                      </div>
                      {liveEvents.slice(-6).reverse().map((e,i)=>(
                        <div key={i} style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,padding:'5px 0',borderTop:`1px solid ${dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)'}` }}>
                          <div style={{ fontSize:10,color:dark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.4)',fontFamily:'var(--mono)' }}>{(e.visitor_id??'—').slice(0,8)}</div>
                          <div style={{ fontSize:10,color:'var(--accent1)',fontFamily:'var(--mono)' }}>{e.event_type.replace('_',' ')}</div>
                          <div style={{ fontSize:10,color:dark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.4)',fontFamily:'var(--mono)' }}>{(e.zone_name??'—').slice(0,10)}</div>
                          <div style={{ fontSize:10,color:'#00e5a0',fontFamily:'var(--mono)',fontWeight:700 }}>HIGH</div>
                        </div>
                      ))}
                    </Card>
                  </div>
                </div>
              </Reveal>
            </div>
          )}
        </div>

        {/* Footer ticker */}
        <div style={{ padding:'8px 18px',borderTop:`1px solid ${dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.07)'}`,background:dark?'rgba(4,8,16,0.98)':'rgba(248,250,255,0.98)',flexShrink:0 }}>
          <EventTicker dark={dark} events={liveEvents} />
        </div>
      </div>

      {compareOpen && compareData && <CompareModal dark={dark} data={compareData} onClose={()=>setCompareOpen(false)} />}
    </div>
  )
}

// ── ROOT APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [entered,setEntered] = useState(false)
  const { dark, toggleDark } = useTheme()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Fira+Code:wght@400;500;600&display=swap');

        :root {
          --bg:      ${dark ? '#030710' : '#f4f6ff'};
          --surface: ${dark ? '#080e1c' : '#ffffff'};
          --border:  ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)'};
          --text:    ${dark ? '#e8f0fe' : '#111827'};
          --text-dim:${dark ? '#4a5568' : '#6b7280'};
          --accent1: #00ffc8;
          --accent2: #ff6b35;
          --display: 'Syne', sans-serif;
          --body:    'DM Sans', sans-serif;
          --mono:    'Fira Code', monospace;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
        html, body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--body);
          height: 100%;
          overflow: hidden;
          transition: background 0.4s, color 0.3s;
        }
        #root { height: 100%; overflow: auto }
        ::-webkit-scrollbar { width: 4px; height: 4px }
        ::-webkit-scrollbar-thumb { background: ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)'}; border-radius: 2px }
        ::-webkit-scrollbar-track { background: transparent }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes scanline { 0%{top:0%} 100%{top:100%} }
        @keyframes ripple { 0%{r:1.3;opacity:0.4} 100%{r:2.8;opacity:0} }
        @keyframes float0 { from{transform:translateY(0)} to{transform:translateY(-14px)} }
        @keyframes float1 { from{transform:translateY(0)} to{transform:translateY(-20px)} }
        @keyframes float2 { from{transform:translateY(0)} to{transform:translateY(-9px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:none} }
        @keyframes pulse-badge { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes slide-in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }

        button:focus-visible { outline: 2px solid var(--accent1); outline-offset: 2px; }
      `}</style>

      {!entered ? (
        <div style={{ height:'100%',overflowY:'auto' }}>
          <LandingPage onEnter={()=>setEntered(true)} dark={dark} toggleDark={toggleDark} />
        </div>
      ) : (
        <Dashboard dark={dark} toggleDark={toggleDark} />
      )}
    </>
  )
}