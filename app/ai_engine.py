from fastapi import APIRouter
from datetime import datetime
router = APIRouter(prefix='/ai', tags=['AI Command Center'])

@router.get('/command-center')
def command_center():
    return {'store_health':94,'hot_zone':'Beauty & Skincare','ai_recommendations':['Increase staff at billing 6-8 PM','Move promotions near high dwell zones'],'generated_at':datetime.utcnow()}
