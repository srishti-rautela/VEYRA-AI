import React, { useState, useEffect, useRef, useCallback } from 'react';

interface StoreLayoutMapProps {
  apiBase: string;
  storeId: string;
  metrics: {
    store_id: string;
    unique_visitors: number;
    conversion_rate: number;
    avg_dwell_per_zone: { zone_id: string; avg_dwell_seconds: number; visit_count: number }[];
    queue_depth: number;
    abandonment_rate: number;
    computed_at: string;
  } | null;
  speed: number;
  onRestartSimulation: () => Promise<void>;
  selectedCam?: string;
  hideCCTV?: boolean;
  onCameraChange?: (camId: string) => void;
}

interface ZoneDef {
  id: string;
  label: string;
  sublabel?: string;
  icon: string;
  x: number; y: number; w: number; h: number; // 0-1 fractions of canvas
  color: string;
  glowColor: string;
  type: 'entry' | 'floor' | 'billing' | 'queue' | 'impulse';
}

interface Person {
  id: number;
  x: number; y: number;
  tx: number; ty: number;
  zoneId: string;
  speed: number;
  color: string;
  size: number;
  opacity: number;
  dwellTimer: number;
  dwellMax: number;
}

// Store floor plan zones (normalized 0-1 coordinates)
const ZONES: ZoneDef[] = [
  {
    id: 'ENTRY',
    label: 'Main Entrance',
    sublabel: '+ Exit',
    icon: '🚪',
    x: 0, y: 0, w: 1, h: 0.10,
    color: '#00dc64',
    glowColor: 'rgba(0,220,100,0.15)',
    type: 'entry',
  },
  {
    id: 'SKINCARE',
    label: 'Skincare',
    sublabel: 'Moisturisers · Serums',
    icon: '✨',
    x: 0, y: 0.10, w: 0.45, h: 0.45,
    color: '#c855ff',
    glowColor: 'rgba(200,85,255,0.12)',
    type: 'floor',
  },
  {
    id: 'HAIRCARE',
    label: 'Haircare',
    sublabel: 'Shampoo · Treatments',
    icon: '💆',
    x: 0.45, y: 0.10, w: 0.55, h: 0.45,
    color: '#ff6b3d',
    glowColor: 'rgba(255,107,61,0.12)',
    type: 'floor',
  },
  {
    id: 'FRAGRANCES',
    label: 'Fragrances',
    sublabel: 'Perfumes · Attars',
    icon: '🌸',
    x: 0, y: 0.55, w: 0.32, h: 0.45,
    color: '#3cc8ff',
    glowColor: 'rgba(60,200,255,0.12)',
    type: 'floor',
  },
  {
    id: 'IMPULSE_BUYS',
    label: 'Impulse',
    sublabel: 'Snacks · Minis',
    icon: '🛒',
    x: 0.32, y: 0.55, w: 0.13, h: 0.45,
    color: '#ffb83d',
    glowColor: 'rgba(255,184,61,0.12)',
    type: 'impulse',
  },
  {
    id: 'BILLING_COUNTER',
    label: 'Billing',
    sublabel: 'Counter',
    icon: '🏷️',
    x: 0.45, y: 0.55, w: 0.27, h: 0.22,
    color: '#008cff',
    glowColor: 'rgba(0,140,255,0.18)',
    type: 'billing',
  },
  {
    id: 'BILLING_QUEUE',
    label: 'Queue',
    sublabel: 'Waiting Area',
    icon: '⏳',
    x: 0.45, y: 0.77, w: 0.27, h: 0.23,
    color: '#0055cc',
    glowColor: 'rgba(0,85,200,0.18)',
    type: 'queue',
  },
  {
    id: 'WELLNESS',
    label: 'Wellness',
    sublabel: 'Supplements · Health',
    icon: '💊',
    x: 0.72, y: 0.55, w: 0.28, h: 0.45,
    color: '#3cffb4',
    glowColor: 'rgba(60,255,180,0.12)',
    type: 'floor',
  },
];

const PERSON_COLORS = [
  '#00ffc8', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#ff6bc8', '#c8ff6b', '#ffa96b', '#6bffff', '#ff9fdf',
];

const ZONE_WEIGHTS: Record<string, number> = {
  SKINCARE: 30, HAIRCARE: 22, FRAGRANCES: 15, WELLNESS: 12,
  IMPULSE_BUYS: 8, BILLING_COUNTER: 7, BILLING_QUEUE: 4, ENTRY: 2,
};

const CAM_TO_ZONES: Record<string, string[]> = {
  CAM_1: ['ENTRY'],
  CAM_2: ['SKINCARE', 'HAIRCARE', 'FRAGRANCES', 'WELLNESS'],
  CAM_3: ['BILLING_COUNTER', 'BILLING_QUEUE', 'IMPULSE_BUYS'],
  CAM_4: ['ENTRY'],
  CAM_5: ['BILLING_COUNTER', 'BILLING_QUEUE'],
};

const CAM_LABELS: Record<string, string> = {
  CAM_1: 'Main Entrance (CCTV 1)',
  CAM_2: 'Main Floor (CCTV 2)',
  CAM_3: 'Billing Counter (CCTV 3)',
  CAM_4: 'Secondary Entrance (CCTV 4)',
  CAM_5: 'Billing Queue (CCTV 5)',
};

function randomInZone(zone: ZoneDef, cw: number, ch: number) {
  const pad = 0.08;
  return {
    x: (zone.x + pad + Math.random() * (zone.w - 2 * pad)) * cw,
    y: (zone.y + pad + Math.random() * (zone.h - 2 * pad)) * ch,
  };
}

function pickZone(): ZoneDef {
  const total = Object.values(ZONE_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const zone of ZONES) {
    r -= ZONE_WEIGHTS[zone.id] ?? 0;
    if (r <= 0) return zone;
  }
  return ZONES[1];
}

// Queue positions logic with slight organic human swaying
function getQueuePos(index: number, cw: number, ch: number) {
  const qx = 0.585 * cw;
  const qyStart = 0.81 * ch;
  const spacing = 0.045 * ch;
  return {
    x: qx + (Math.sin(index * 2 + Date.now() / 1500) * 3), // organic swaying
    y: qyStart + index * spacing,
  };
}

export const StoreLayoutMap: React.FC<StoreLayoutMapProps> = ({
  apiBase,
  storeId,
  metrics,
  speed,
  onRestartSimulation,
  selectedCam: propSelectedCam,
  hideCCTV = false,
  onCameraChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const personsRef = useRef<Person[]>([]);
  const animFrameRef = useRef<number>(0);

  const [zoneCounts, setZoneCounts] = useState<Record<string, number>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const canvasSize = useRef({ w: 600, h: 420 });

  // Camera Selector states
  const [localSelectedCam, setLocalSelectedCam] = useState<string>('CAM_1');
  const selectedCam = propSelectedCam || localSelectedCam;
  const setSelectedCam = setLocalSelectedCam;
  const [switching, setSwitching] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now());
  const [yoloOnline, setYoloOnline] = useState(false);
  const [yoloBase] = useState(() => {
    return localStorage.getItem('yolo_base_url') || 'http://localhost:8001';
  });

  // Handle switching cameras and syncing with YOLO if online
  const handleCameraChange = async (camId: string) => {
    setSelectedCam(camId);
    if (onCameraChange) {
      onCameraChange(camId);
    }
    setSwitching(true);
    setStreamError(false);
    setStreamKey(Date.now());
    try {
      await fetch(`${yoloBase}/switch/${camId}`, { method: 'POST' });
      await fetch(`${yoloBase}/speed/${speed}`, { method: 'POST' });
    } catch { /* ignore */ }
    setTimeout(() => setSwitching(false), 200);
  };

  // Video playback speed sync
  const applyVideoPlaybackRate = useCallback(() => {
    if (videoRef.current) {
      try {
        videoRef.current.playbackRate = speed;
      } catch (err) {
        console.warn('Failed to set video playbackRate:', err);
      }
    }
  }, [speed]);

  // Apply speed changes immediately when playback starts or speed changes
  useEffect(() => {
    applyVideoPlaybackRate();
  }, [speed, selectedCam, streamKey, applyVideoPlaybackRate]);

  // Periodically check if YOLO server is running locally
  useEffect(() => {
    let active = true;
    const checkYolo = async () => {
      try {
        const r = await fetch(`${yoloBase}/stats`);
        if (r.ok && active) {
          setYoloOnline(true);
        } else if (active) {
          setYoloOnline(false);
        }
      } catch {
        if (active) setYoloOnline(false);
      }
    };
    checkYolo();
    const interval = setInterval(checkYolo, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [yoloBase]);

  // Init / resize persons based on visitor count and synchronize queue assignment
  useEffect(() => {
    const count = Math.max(8, Math.min(25, (metrics?.unique_visitors ?? 12)));
    const cw = canvasSize.current.w;
    const ch = canvasSize.current.h;
    const existing = personsRef.current;

    // Add missing persons
    while (existing.length < count) {
      const zone = pickZone();
      const pos = randomInZone(zone, cw, ch);
      const tgt = randomInZone(pickZone(), cw, ch);
      existing.push({
        id: existing.length,
        x: pos.x, y: pos.y,
        tx: tgt.x, ty: tgt.y,
        zoneId: zone.id,
        speed: 0.012 + Math.random() * 0.016,
        color: PERSON_COLORS[existing.length % PERSON_COLORS.length],
        size: 4 + Math.random() * 2.5,
        opacity: 0.75 + Math.random() * 0.25,
        dwellTimer: 0,
        dwellMax: 1200 + Math.random() * 1800,
      });
    }
    // Remove excess
    if (existing.length > count) existing.splice(count);

    // Sync queue positions for the first `queue_depth` persons
    const qd = metrics?.queue_depth ?? 0;
    existing.forEach((p, idx) => {
      if (idx < qd) {
        p.zoneId = 'BILLING_QUEUE';
        const qPos = getQueuePos(idx, cw, ch);
        p.tx = qPos.x;
        p.ty = qPos.y;
        // Snap closer if far away to avoid long travel times when queue suddenly grows
        if (Math.abs(p.x - p.tx) > 80 || Math.abs(p.y - p.ty) > 80) {
          p.x = p.tx;
          p.y = p.ty;
        }
      } else {
        // If they were in queue previously but are now free, assign new floor zone
        if (p.zoneId === 'BILLING_QUEUE') {
          const newZone = pickZone();
          const safeZone = (newZone.id === 'BILLING_QUEUE' || newZone.id === 'BILLING_COUNTER') ? ZONES[1] : newZone;
          const pos = randomInZone(safeZone, cw, ch);
          p.tx = pos.x;
          p.ty = pos.y;
          p.zoneId = safeZone.id;
          p.dwellTimer = 0;
        }
      }
    });
  }, [metrics]);

  // Compute zone counts from person positions
  const updateZoneCounts = useCallback(() => {
    const cw = canvasSize.current.w;
    const ch = canvasSize.current.h;
    const counts: Record<string, number> = {};
    for (const p of personsRef.current) {
      const nx = p.x / cw, ny = p.y / ch;
      for (const z of ZONES) {
        if (nx >= z.x && nx <= z.x + z.w && ny >= z.y && ny <= z.y + z.h) {
          counts[z.id] = (counts[z.id] ?? 0) + 1;
          break;
        }
      }
    }
    setZoneCounts(counts);
  }, []);

  // Synchronize dynamic states to refs to avoid restarting the animation loop and leaking multiple loops
  const hoveredRef = useRef<string | null>(null);
  hoveredRef.current = hovered;

  const zoneCountsRef = useRef<Record<string, number>>({});
  zoneCountsRef.current = zoneCounts;

  const selectedCamRef = useRef<string>('CAM_1');
  selectedCamRef.current = selectedCam;

  const metricsRef = useRef<any>(null);
  metricsRef.current = metrics;

  const speedRef = useRef<number>(1.0);
  speedRef.current = speed;

  const animFrameIdRef = useRef<number>(0);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const cw = canvas.width;
      const ch = canvas.height;
      canvasSize.current = { w: cw, h: ch };
      ctx.clearRect(0, 0, cw, ch);

      // Background
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, cw, ch);

      // ── Draw Zones ──
      for (const zone of ZONES) {
        const x = zone.x * cw, y = zone.y * ch;
        const w = zone.w * cw, h = zone.h * ch;
        const isHovered = hoveredRef.current === zone.id;
        const count = zoneCountsRef.current[zone.id] ?? 0;
        const heat = Math.min(count / 8, 1); // 0-1 heat intensity

        ctx.save();
        // Base fill
        ctx.fillStyle = zone.glowColor;
        ctx.fillRect(x, y, w, h);
        // Heat layer
        if (heat > 0) {
          const heatAlpha = heat * 0.18;
          ctx.fillStyle = `rgba(255,80,80,${heatAlpha})`;
          ctx.fillRect(x, y, w, h);
        }
        // Hover glow
        if (isHovered) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(x, y, w, h);
        }

        // Border
        ctx.strokeStyle = isHovered ? '#ffffff' : zone.color;
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.globalAlpha = isHovered ? 0.9 : 0.55;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        ctx.globalAlpha = 1;

        // Dashed inner border for aesthetic
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = zone.color;
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Corner accent dots
        const corners = [[x+3,y+3],[x+w-3,y+3],[x+3,y+h-3],[x+w-3,y+h-3]];
        for (const [cx2, cy2] of corners) {
          ctx.beginPath();
          ctx.arc(cx2, cy2, 2, 0, Math.PI * 2);
          ctx.fillStyle = zone.color;
          ctx.globalAlpha = 0.5;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Zone label
        const midX = x + w / 2;
        const midY = y + h / 2;

        if (w > 60 && h > 40) {
          // Icon
          ctx.font = `${Math.min(w, h) > 80 ? 18 : 13}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(zone.icon, midX, midY - (h > 60 ? 16 : 8));

          // Label
          ctx.font = `600 ${Math.min(11, w / 6.5)}px "Inter", sans-serif`;
          ctx.fillStyle = zone.color;
          ctx.globalAlpha = 0.95;
          ctx.fillText(zone.label, midX, midY + (h > 60 ? 2 : 2));

          // Sublabel (only for larger zones)
          if (h > 70 && zone.sublabel) {
            ctx.font = `${Math.min(9, w / 8.5)}px "Inter", sans-serif`;
            ctx.fillStyle = '#94a3b8';
            ctx.globalAlpha = 0.7;
            ctx.fillText(zone.sublabel, midX, midY + 14);
          }
          ctx.globalAlpha = 1;

          // Person count badge
          if (count > 0) {
            const bw = count > 9 ? 28 : 22;
            const bh = 16;
            const bx = x + w - bw - 4;
            const by = y + 4;
            ctx.fillStyle = zone.color;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 8);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.font = `700 9px "Inter", sans-serif`;
            ctx.fillStyle = '#000';
            ctx.fillText(`${count}`, bx + bw / 2, by + 11);
          }
        }
        ctx.restore();
      }

      // ── Draw CCTV Monitored Zones Scanning Effect ──
      const cctvZones = CAM_TO_ZONES[selectedCamRef.current] ?? [];
      for (const zoneId of cctvZones) {
        const zone = ZONES.find(z => z.id === zoneId);
        if (zone) {
          const x = zone.x * cw, y = zone.y * ch;
          const w = zone.w * cw, h = zone.h * ch;
          
          ctx.save();
          // Pulsing monitored boundary
          ctx.strokeStyle = '#00ffc8';
          ctx.lineWidth = 2.0;
          ctx.globalAlpha = 0.4 + 0.25 * Math.sin(Date.now() / 200);
          ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
          
          // Horizontal laser scanner beam
          const sweepSpeed = 0.02 * speedRef.current;
          const sweepY = x === 0 && y === 0 
            ? y + 3 // For entrance, just keep a subtle top indicator
            : y + 3 + ((Date.now() * sweepSpeed) % (h - 8));
          
          if (!(x === 0 && y === 0)) {
            const grad = ctx.createLinearGradient(x, sweepY - 8, x, sweepY);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(1, 'rgba(0, 255, 200, 0.12)');
            ctx.fillStyle = grad;
            ctx.fillRect(x + 3, sweepY - 8, w - 6, 8);
            
            ctx.strokeStyle = '#00ffc8';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(x + 3, sweepY);
            ctx.lineTo(x + w - 3, sweepY);
            ctx.stroke();
          }
          
          // CCTV Tag in corner
          ctx.font = '700 8px "JetBrains Mono", monospace';
          ctx.fillStyle = '#00ffc8';
          ctx.globalAlpha = 0.8;
          ctx.fillText('📷 MONITORED BY ' + selectedCamRef.current, x + 10, y + 16);
          ctx.restore();
        }
      }

      // ── Draw walls/dividers ──
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      // Entry divider
      ctx.beginPath();
      ctx.moveTo(0, 0.10 * ch);
      ctx.lineTo(cw, 0.10 * ch);
      ctx.stroke();
      // Main floor divider
      ctx.beginPath();
      ctx.moveTo(0, 0.55 * ch);
      ctx.lineTo(cw, 0.55 * ch);
      ctx.stroke();
      // Vertical dividers
      ctx.beginPath();
      ctx.moveTo(0.45 * cw, 0.10 * ch);
      ctx.lineTo(0.45 * cw, 0.55 * ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.32 * cw, 0.55 * ch);
      ctx.lineTo(0.32 * cw, ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.45 * cw, 0.55 * ch);
      ctx.lineTo(0.45 * cw, ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.72 * cw, 0.55 * ch);
      ctx.lineTo(0.72 * cw, ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0.45 * cw, 0.77 * ch);
      ctx.lineTo(0.72 * cw, 0.77 * ch);
      ctx.stroke();
      ctx.restore();

      // ── Move & draw persons ──
      let frameCount = (animFrameRef.current + 1) % 10000;
      animFrameRef.current = frameCount;

      // Real-time queue position synchronization
      const qd = metricsRef.current?.queue_depth ?? 0;
      personsRef.current.forEach((p, idx) => {
        if (idx < qd) {
          const qPos = getQueuePos(idx, cw, ch);
          p.tx = qPos.x;
          p.ty = qPos.y;
          p.zoneId = 'BILLING_QUEUE';
        }
      });

      for (const p of personsRef.current) {
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 3) {
          // Increment dwell timer scaled by simulation speed
          p.dwellTimer += speedRef.current;
          if (p.dwellTimer >= p.dwellMax) {
            // Pick new target zone (if not locked in queue)
            const isQueued = personsRef.current.indexOf(p) < qd;
            if (!isQueued) {
              const newZone = pickZone();
              const tgt = randomInZone(newZone, cw, ch);
              p.tx = tgt.x;
              p.ty = tgt.y;
              p.zoneId = newZone.id;
              p.dwellTimer = 0;
              p.dwellMax = 1200 + Math.random() * 1800;
            }
          }
        } else {
          // Walk speed scaled by simulation speed (fixed at 1.0x for realistic visual flow)
          const spd = p.speed * 1.0;
          p.x += (dx / dist) * spd;
          p.y += (dy / dist) * spd;
        }

        // Draw person dot with glow
        ctx.save();
        // Outer glow
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, p.color + 'aa');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
        ctx.restore();
      }

      // Update zone counts every 15 frames
      if (frameCount % 15 === 0) updateZoneCounts();

      animFrameIdRef.current = requestAnimationFrame(draw);
    };

    animFrameIdRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameIdRef.current);
  }, [updateZoneCounts]);

  // Canvas hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    let found: string | null = null;
    for (const zone of ZONES) {
      if (nx >= zone.x && nx <= zone.x + zone.w && ny >= zone.y && ny <= zone.y + zone.h) {
        found = zone.id;
        break;
      }
    }
    setHovered(found);
  }, []);

  const totalPeople = personsRef.current.length;

  return (
    <div className="store-layout-container">
      {/* 1. Header with speed controls */}
      <div className="cam-control-header">
        <div className="cam-title-badge">
          <span className="ai-badge-dot animate-pulse" />
          <span className="ai-badge-text">🏪 LIVE CONTROL & SPATIAL INTEL ({storeId.replace('STORE_', '').replace(/_/g, ' ')})</span>
        </div>
        
        {/* Real-time Status Panel */}
        <div className="cam-speed-selector" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#00ffc8', fontWeight: 700, letterSpacing: '0.05em', background: 'rgba(0,255,200,0.06)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(0,255,200,0.15)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ffc8', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
            REAL-TIME MODE
          </div>
          
          <button
            onClick={onRestartSimulation}
            className="speed-btn restart-btn"
            title="Reset database and sync playback from the beginning"
            style={{
              border: '1px dashed rgba(255,255,255,0.2)',
              color: '#94a3b8',
              background: 'transparent',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 600,
            }}
          >
            🔄 Sync & Restart
          </button>
        </div>
      </div>

      {/* 2. Main split view layout */}
      <div className="store-map-wrapper" style={{ display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
        
        {/* LEFT COLUMN: CCTV Live Video Feed (45% width) */}
        {!hideCCTV && (
          <div className="cctv-column" style={{ flex: '1 1 43%', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="cam-main-player" style={{ position: 'relative', width: '100%', aspectRatio: '16/10', background: '#09090e', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', overflow: 'hidden' }}>
              
              {switching && (
                <div className="cam-switching-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(5, 8, 20, 0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', zIndex: 10 }}>
                  <div className="cam-spinner" />
                  <span style={{ fontSize: '0.8rem', color: '#c855ff', fontWeight: 600, letterSpacing: '0.05em' }}>Switching CCTV stream...</span>
                </div>
              )}

              {!streamError ? (
                <div className="cam-video-wrap" style={{ position: 'relative', width: '100%', height: '100%' }}>
                  {/* Live Badge */}
                  <div className={`cam-overlay-badge live ${yoloOnline ? 'local' : 'simulated'}`} style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 5, background: 'rgba(5,8,20,0.85)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 700 }}>
                    <span className="cam-live-dot green-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: yoloOnline ? '#00dc64' : '#ffd93d', display: 'inline-block' }} />
                    {yoloOnline ? 'YOLOv8 STREAM (LOCAL)' : 'CCTV FEED (SIMULATED)'}
                  </div>
                  
                  {/* Overlay details */}
                  <div className="cam-overlay-label" style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 5, background: 'rgba(5,8,20,0.85)', padding: '5px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#e2e8f0', fontWeight: 600 }}>
                    <span className="cam-overlay-icon" style={{ color: '#00ffc8' }}>⚡</span>
                    {selectedCam && CAM_LABELS[selectedCam]}
                  </div>

                  {selectedCam ? (
                    <img
                      src={yoloOnline ? `${yoloBase}/stream?t=${streamKey}` : `${apiBase}/cameras/stream/${selectedCam}?t=${streamKey}`}
                      alt="YOLO Object Detection Stream"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setStreamError(true)}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="cam-no-signal yolo-offline" style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', alignItems: 'center' }}>
                  <span style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚠️</span>
                  <h4 style={{ color: '#ff6b6b', margin: '0 0 6px 0', fontSize: '0.9rem' }}>CCTV Signal Stream Error</h4>
                  <p style={{ color: '#64748b', fontSize: '0.72rem', margin: '0 0 16px 0', maxWidth: '280px' }}>
                    Cannot connect to pre-recorded footage feed or YOLO stream server.
                  </p>
                  <button
                    className="retry-btn"
                    onClick={() => { setStreamError(false); setStreamKey(Date.now()); }}
                    style={{ padding: '6px 18px', background: 'rgba(200,85,255,0.2)', border: '1px solid #c855ff', borderRadius: '6px', color: '#c855ff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Retry Connection
                  </button>
                </div>
              )}
            </div>

            {/* Camera Selection thumbnails */}
            <div className="cam-thumb-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {['CAM_1', 'CAM_2', 'CAM_3', 'CAM_4', 'CAM_5'].map((camId) => {
                const active = selectedCam === camId;
                return (
                  <button
                    key={camId}
                    className={`cam-thumb ${active ? 'active' : ''}`}
                    onClick={() => handleCameraChange(camId)}
                    style={{
                      background: active ? 'rgba(200, 85, 255, 0.12)' : 'rgba(15, 20, 40, 0.5)',
                      border: active ? '1px solid #c855ff' : '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      padding: '8px 4px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '1rem', opacity: active ? 1 : 0.6 }}>📹</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, color: active ? '#c855ff' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                      {camId === 'CAM_1' ? 'Entrance 1' : camId === 'CAM_2' ? 'Floor' : camId === 'CAM_3' ? 'Billing' : camId === 'CAM_4' ? 'Entrance 2' : 'Queue'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: 2D Spatial Floor Plan & Legend (53% width) */}
        <div className="map-column" style={{ flex: hideCCTV ? '1 1 100%' : '1 1 53%', minWidth: '380px', display: 'flex', gap: '16px' }}>
          {/* Canvas map wrapper */}
          <div style={{ position: 'relative', flex: 1, minWidth: 0, height: '420px' }}>
            <canvas
              ref={canvasRef}
              width={640}
              height={420}
              style={{ width: '100%', height: '100%', cursor: hovered ? 'crosshair' : 'default', display: 'block', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHovered(null)}
            />
            {/* Floating HUD overlay */}
            <div className="map-hud-overlay">
              <div className="hud-chip">
                <span className="hud-chip-dot" style={{ background: '#00ffc8' }} />
                <span className="hud-chip-val">{totalPeople}</span>
                <span className="hud-chip-lbl">In Store</span>
              </div>
              {metrics?.queue_depth !== undefined && (
                <div className="hud-chip">
                  <span className="hud-chip-dot" style={{ background: '#008cff' }} />
                  <span className="hud-chip-val">{metrics.queue_depth}</span>
                  <span className="hud-chip-lbl">Queue</span>
                </div>
              )}
              <div className="hud-chip">
                <span className="hud-chip-dot" style={{ background: '#c855ff', animation: 'pulse 1.2s infinite' }} />
                <span className="hud-chip-lbl" style={{ color: '#94a3b8', fontSize: '0.62rem' }}>PLAYBACK SYNCED ({speed}x)</span>
              </div>
            </div>
          </div>

          {/* Legend sidebar */}
          <div className="store-map-legend" style={{ width: '170px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="legend-title" style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700 }}>Spatial Traffic</div>
            {ZONES.filter(z => z.id !== 'ENTRY').map(zone => {
              const count = zoneCounts[zone.id] ?? 0;
              const pct = totalPeople > 0 ? (count / totalPeople) * 100 : 0;
              return (
                <div
                  key={zone.id}
                  className={`legend-item ${hovered === zone.id ? 'hovered' : ''}`}
                  onMouseEnter={() => setHovered(zone.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    padding: '6px 8px',
                    background: 'rgba(15, 20, 40, 0.4)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    transition: 'all 0.15s',
                  }}
                >
                  <div className="legend-item-header" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '9px' }}>{zone.icon}</span>
                    <span className="legend-zone-name" style={{ color: zone.color, fontSize: '0.68rem', fontWeight: 600, flex: 1 }}>{zone.label}</span>
                    <span className="legend-count" style={{ fontSize: '0.68rem', fontWeight: 800, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
                  </div>
                  <div className="legend-bar-track" style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      className="legend-bar-fill"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        background: zone.color,
                        boxShadow: `0 0 6px ${zone.color}66`,
                        height: '100%',
                        borderRadius: '2px',
                        transition: 'width 0.4s ease-out',
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Hovered details card */}
            {hovered && (() => {
              const z = ZONES.find(z => z.id === hovered);
              if (!z) return null;
              return (
                <div className="legend-hover-card" style={{ borderColor: z.color + '44', padding: '8px 10px', marginTop: '4px', background: 'rgba(10, 15, 30, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                  <div style={{ color: z.color, fontWeight: 700, fontSize: '0.68rem' }}>{z.icon} {z.label}</div>
                  {z.sublabel && <div style={{ color: '#64748b', fontSize: '0.58rem', margin: '1px 0 3px 0' }}>{z.sublabel}</div>}
                  <div style={{ color: '#94a3b8', fontSize: '0.65rem' }}>
                    Occupancy: <span style={{ color: '#fff', fontWeight: 700 }}>{zoneCounts[hovered] ?? 0}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StoreLayoutMap;
