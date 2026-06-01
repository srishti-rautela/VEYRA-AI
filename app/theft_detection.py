def detect_suspicious_behavior(dwell, movement_score):
    risk=min(100,dwell*2+movement_score)
    return {'risk':risk,'alert':risk>75}
