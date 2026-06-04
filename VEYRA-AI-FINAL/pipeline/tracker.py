"""ByteTrack Re-ID wrapper. See run.py for full pipeline."""
import numpy as np

class SimpleTracker:
    """IoU-based tracker fallback when ByteTrack unavailable."""
    def __init__(self):
        self.tracks = {}
        self.next_id = 1

    def update(self, detections):
        # Simplified: assign new ID if no IoU match
        results = []
        for det in detections:
            tid = self.next_id
            self.next_id += 1
            self.tracks[tid] = det
            results.append({"track_id": tid, "bbox": det})
        return results
