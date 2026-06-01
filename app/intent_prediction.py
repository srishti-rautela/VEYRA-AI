def predict_intent(dwell_time, zones, revisits):
    score=min(100, dwell_time*3+zones*10+revisits*15)
    return {'score':score,'label':'HIGH' if score>70 else 'MEDIUM' if score>40 else 'LOW'}
