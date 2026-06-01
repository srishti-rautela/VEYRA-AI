import React, { useState, useEffect } from 'react';

interface Camera {
  cam_id: string;
  name: string;
  filename: string;
  available: boolean;
  stream_url: string;
}

interface CameraFeedProps {
  apiBase: string;
  storeId: string;
  selectedCam?: string;
  onCameraChange?: (camId: string) => void;
}

const STORE_CAM_MAPPING: Record<string, string[]> = {
  STORE_BLR_002: ['CAM_1', 'CAM_2', 'CAM_3', 'CAM_4', 'CAM_5'],
  ST1008: ['CAM_1', 'CAM_2', 'CAM_3', 'CAM_4', 'CAM_5'],
};

const CAM_LABELS: Record<string, string> = {
  CAM_1: 'Main Store View (CCTV 1)',
  CAM_2: 'Main Product Section (CCTV 2)',
  CAM_3: 'Entrance 1 (CCTV 3)',
  CAM_4: 'Entrance 2 (CCTV 4)',
  CAM_5: 'Billing Counter (CCTV 5)',
};

const CAM_ZONES_CONFIG: Record<string, { label: string; zones: { name: string; color: string }[] }> = {
  CAM_1: {
    label: 'Full Store Coverage',
    zones: [
      { name: 'Customer Movement', color: '#00ff88' },
    ],
  },
  CAM_2: {
    label: 'Product Area',
    zones: [
      { name: 'Shopping Area', color: '#00ff88' },
    ],
  },
  CAM_3: {
    label: 'Entrance Detection',
    zones: [
      { name: 'Entry Line', color: '#00ffc8' },
    ],
  },
  CAM_4: {
    label: 'Entrance Detection',
    zones: [
      { name: 'Entry Line', color: '#00ffc8' },
    ],
  },
  CAM_5: {
    label: 'Billing Counter',
    zones: [
      { name: 'Staff Area', color: '#ff9900' },
      { name: 'Customer Queue', color: '#00ff88' },
    ],
  },
};

export const CameraFeed: React.FC<CameraFeedProps> = ({
  apiBase,
  storeId,
  selectedCam,
  onCameraChange,
}) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const selected = selectedCam || localSelected;

  const setSelected = (val: string | null) => {
    setLocalSelected(val);
    if (onCameraChange && val) {
      onCameraChange(val);
    }
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yoloOnline, setYoloOnline] = useState(false);
  const [yoloStats, setYoloStats] = useState<{ people: number; frame: number; fps: number } | null>(null);
  const [speed] = useState(1.0);
  const [switching, setSwitching] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now());

  const [yoloBase, setYoloBase] = useState(() => {
    return localStorage.getItem('yolo_base_url') || 'http://localhost:8001';
  });

  const [streamError, setStreamError] = useState(false);

  useEffect(() => {
    setStreamError(false);
    setStreamKey(Date.now());
  }, [selected, yoloOnline]);

  useEffect(() => {
    let active = true;
    const checkYolo = async () => {
      try {
        const r = await fetch(`${yoloBase}/stats`);
        if (r.ok) {
          if (active) {
            setYoloOnline(true);
            const data = await r.json();
            setYoloStats(data);
          }
        } else {
          if (active) {
            setYoloOnline(false);
            fetchBackendStats();
          }
        }
      } catch {
        if (active) {
          setYoloOnline(false);
          fetchBackendStats();
        }
      }
    };

    const fetchBackendStats = async () => {
      if (!selected) return;
      try {
        const r = await fetch(`${apiBase}/cameras/stats/${selected}`);
        if (r.ok && active) {
          const data = await r.json();
          setYoloStats(data);
        }
      } catch {
      }
    };

    checkYolo();
    const interval = setInterval(checkYolo, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selected, yoloBase, apiBase]);

  useEffect(() => {
    fetch(`${apiBase}/cameras`)
      .then((r) => r.json())
      .then((d) => {
        const cams: Camera[] = d.cameras ?? [];
        setCameras(cams);
        setLoading(false);
        const allowed = STORE_CAM_MAPPING[storeId] ?? [];
        const firstAllowed = cams.find(c => allowed.includes(c.cam_id));
        if (firstAllowed && !selected) {
          setSelected(firstAllowed.cam_id);
          setStreamKey(Date.now());
        }
      })
      .catch(() => {
        setError('Cannot reach camera API. Is the backend running?');
        setLoading(false);
      });
  }, [apiBase]);

  useEffect(() => {
    const allowed = STORE_CAM_MAPPING[storeId] ?? [];
    if (allowed.length > 0) {
      const activeCam = allowed[0];
      setSelected(activeCam);
      triggerYoloSwitch(activeCam);
    }
  }, [storeId]);

  const triggerYoloSwitch = async (camId: string) => {
    setSwitching(true);
    setStreamKey(Date.now());
    setTimeout(() => setSwitching(false), 300);
  };

  const handleCameraChange = (camId: string) => {
    setSelected(camId);
    triggerYoloSwitch(camId);
  };

  const handleRestartSimulation = async () => {
    if (!selected) return;
    try {
      await fetch(`${apiBase}/simulation/start?speed=${speed}&cam_id=${selected}`, { method: 'POST' });
    } catch (err) {
      console.warn('Failed to restart simulation:', err);
    }
  };

  const allowedCams = STORE_CAM_MAPPING[storeId] ?? [];
  const currentCamConfig = selected ? CAM_ZONES_CONFIG[selected] : null;

  if (loading) {
    return (
      <div className="cam-loading">
        <div className="cam-spinner" />
        <span>Connecting to camera feeds...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cam-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="cam-feed-layout">
      <div className="cam-control-header">
        <div className="cam-title-badge">
          <span className="ai-badge-dot animate-pulse" />
          <span className="ai-badge-text">⚡ YOLOv8 LIVE CV STREAM</span>
        </div>

        <div className="cam-speed-selector" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#00ffc8', fontWeight: 700, letterSpacing: '0.05em', background: 'rgba(0,255,200,0.06)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(0,255,200,0.15)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ffc8', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
            REAL-TIME MODE
          </div>

          <button
            onClick={handleRestartSimulation}
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

      <div className="cam-display-container">
        <div className="cam-main-player">
          {switching && (
            <div className="cam-switching-overlay">
              <div className="cam-spinner" />
              <span>Switching YOLO inference stream...</span>
            </div>
          )}

          {!streamError ? (
            <div className="cam-video-wrap">
              <div className="cam-overlay-badge live">
                <span className="cam-live-dot green-pulse" />
                YOLO LIVE (ACTIVE)
              </div>
              <div className="cam-overlay-label">
                <span className="cam-overlay-icon">⚡</span>
                {selected && CAM_LABELS[selected]}
                <span className="cam-overlay-zone">AI-Powered</span>
              </div>
              {selected && (
                <img
                  key={selected}
                  src={`${apiBase}/cameras/stream/${selected}?t=${streamKey}`}
                  alt="YOLO Object Detection Stream"
                  className="cam-video-el img-stream"
                  onError={() => setStreamError(true)}
                />
              )}
            </div>
          ) : (
            <div className="cam-no-signal yolo-offline">
              <div className="yolo-offline-card">
                <h3>⚡ YOLO AI Inference Server Offline</h3>
                <p>Start the YOLO detection stream server to view real-time bounding boxes, track IDs, and zone polygon overlays:</p>
                <code>python detection_stream.py --cam {selected || 'CAM_1'} --speed {speed} --port 8001</code>

                <div style={{ marginTop: '20px', marginBottom: '15px', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    YOLO Server URL (e.g. ngrok HTTPS URL for Vercel):
                  </label>
                  <input
                    type="text"
                    value={yoloBase}
                    onChange={(e) => {
                      setYoloBase(e.target.value);
                      localStorage.setItem('yolo_base_url', e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#1a1a26',
                      border: '1px solid #2a2a3d',
                      borderRadius: '6px',
                      color: '#e2e8f0',
                      fontSize: '0.9rem',
                    }}
                    placeholder="http://localhost:8001"
                  />
                </div>

                <button className="retry-btn" onClick={() => { setStreamError(false); triggerYoloSwitch(selected || 'CAM_1'); }}>
                  Retry Connection
                </button>
              </div>
            </div>
          )}
        </div>

        {yoloOnline && (
          <div className="cam-telemetry-sidebar">
            <div className="sidebar-section">
              <div className="section-title">Model Specifications</div>
              <div className="spec-grid">
                <div className="spec-label">Detector:</div>
                <div className="spec-val cyan">YOLOv8n (Nano)</div>
                <div className="spec-label">Tracker:</div>
                <div className="spec-val cyan">ByteTrack</div>
                <div className="spec-label">Classes:</div>
                <div className="spec-val">Person [class_id: 0]</div>
                <div className="spec-label">Hardware:</div>
                <div className="spec-val green">CPU/GPU Inference</div>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="section-title">Real-Time Telemetry</div>
              <div className="telemetry-grid">
                <div className="telemetry-card">
                  <div className="card-lbl">Person Count</div>
                  <div className="card-val pulse-val">{yoloStats?.people ?? 0}</div>
                  <div className="card-sub">Current detections</div>
                </div>
                <div className="telemetry-card">
                  <div className="card-lbl">Inference Speed</div>
                  <div className={`card-val ${yoloStats && yoloStats.fps > 20 ? 'fps-fast' : 'fps-slow'}`}>
                    {yoloStats?.fps ?? 0} <span className="fps-unit">FPS</span>
                  </div>
                  <div className="card-sub">Strided processing (2/1)</div>
                </div>
              </div>
              <div className="frame-counter">
                <span>Processed Frames:</span>
                <span className="frame-no">{yoloStats?.frame ?? 0}</span>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="section-title">Active Overlays ({currentCamConfig?.zones.length ?? 0})</div>
              <div className="overlay-list">
                {currentCamConfig?.zones.map((zone) => (
                  <div key={zone.name} className="overlay-item">
                    <span className="zone-color-dot" style={{ backgroundColor: zone.color }} />
                    <span className="zone-name">{zone.name}</span>
                    <span className="zone-badge">Active Polygon</span>
                  </div>
                ))}
                {selected && (selected === 'CAM_3' || selected === 'CAM_4') && (
                  <div className="overlay-item">
                    <span className="zone-color-dot" style={{ backgroundColor: '#00ffc8' }} />
                    <span className="zone-name">Entry Crossing Line</span>
                    <span className="zone-badge">Line Crossing</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="cam-thumb-grid">
        {cameras
          .filter((cam) => allowedCams.includes(cam.cam_id))
          .map((cam) => (
            <button
              key={cam.cam_id}
              className={`cam-thumb ${selected === cam.cam_id ? 'active' : ''} ${!cam.available ? 'offline' : ''}`}
              onClick={() => cam.available && handleCameraChange(cam.cam_id)}
              title={cam.available ? `Switch to ${CAM_LABELS[cam.cam_id] ?? cam.name}` : 'Feed unavailable'}
            >
              <div className="cam-thumb-inner">
                <div className={`cam-thumb-placeholder ${cam.available ? 'active-indicator' : 'offline'}`}>
                  {cam.available ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="20" height="20">
                      <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: '1.2rem' }}>📵</span>
                  )}
                </div>
              </div>
              <div className="cam-thumb-label">
                <span className={`cam-thumb-status-dot ${cam.available ? 'online' : 'offline'}`} />
                {CAM_LABELS[cam.cam_id] ?? cam.name}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
};

export default CameraFeed;