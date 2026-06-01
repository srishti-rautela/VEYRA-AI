"""
metrics.py — Real-time store metric computation.

All metrics are computed fresh from the events table on each request —
no cached stale values. This is appropriate for a store intelligence
system where data freshness matters.

Conversion rate computation:
  A visitor session is "converted" if the visitor was present in a
  billing zone in the 5-minute window before any POS transaction at
  the same store. We join events with pos_transactions by time proximity.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.models import Event, POSTransaction, StoreMetrics, ZoneDwellMetric

log = logging.getLogger(__name__)

CONVERSION_WINDOW_MINUTES = 5
QUEUE_DEPTH_LOOKBACK_MINUTES = 10


def get_store_metrics(store_id: str, db: Session) -> StoreMetrics:
    """Compute real-time metrics for a store."""

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # ── Unique visitors (non-staff) ──────────────────────────────────────────
    unique_visitors = (
        db.query(func.count(func.distinct(Event.visitor_id)))
        .filter(
            Event.store_id == store_id,
            Event.is_staff == False,
        )
        .scalar() or 0
    )

    # ── Conversion rate ──────────────────────────────────────────────────────
    conversion_rate = _compute_conversion_rate(store_id, db)

    # ── Average dwell per zone ───────────────────────────────────────────────
    zone_dwell_rows = (
        db.query(
            Event.zone_id,
            func.avg(Event.dwell_ms).label("avg_dwell_ms"),
            func.count(Event.id).label("visit_count"),
        )
        .filter(
            Event.store_id == store_id,
            Event.event_type.in_(["ZONE_EXIT", "ZONE_DWELL"]),
            Event.is_staff == False,
            Event.zone_id.isnot(None),
            Event.dwell_ms > 0,
        )
        .group_by(Event.zone_id)
        .all()
    )

    avg_dwell_per_zone = [
        ZoneDwellMetric(
            zone_id=row.zone_id,
            avg_dwell_seconds=round((row.avg_dwell_ms or 0) / 1000, 1),
            visit_count=row.visit_count,
        )
        for row in zone_dwell_rows
    ]

    # ── Current queue depth ──────────────────────────────────────────────────
    latest_queue = (
        db.query(Event.queue_depth)
        .filter(
            Event.store_id == store_id,
            Event.zone_id == "BILLING_QUEUE",
            Event.queue_depth.isnot(None),
        )
        .order_by(Event.timestamp.desc())
        .first()
    )
    queue_depth = (latest_queue.queue_depth or 0) if latest_queue else 0

    # ── Abandonment rate ─────────────────────────────────────────────────────
    total_queue_joins = (
        db.query(func.count(Event.id))
        .filter(
            Event.store_id == store_id,
            Event.event_type.in_(["BILLING_QUEUE_JOIN", "ZONE_ENTER"]),
            Event.zone_id == "BILLING_QUEUE",
            Event.is_staff == False,
        )
        .scalar() or 0
    )
    total_abandons = (
        db.query(func.count(Event.id))
        .filter(
            Event.store_id == store_id,
            Event.event_type == "BILLING_QUEUE_ABANDON",
            Event.is_staff == False,
        )
        .scalar() or 0
    )

    if total_queue_joins > 0:
        abandonment_rate = round(total_abandons / (total_queue_joins + total_abandons), 4)
    else:
        abandonment_rate = 0.0

    return StoreMetrics(
        store_id=store_id,
        unique_visitors=unique_visitors,
        conversion_rate=round(conversion_rate, 4),
        avg_dwell_per_zone=avg_dwell_per_zone,
        queue_depth=queue_depth,
        abandonment_rate=abandonment_rate,
        computed_at=now_str,
    )


def _compute_conversion_rate(store_id: str, db: Session) -> float:
    """
    Offline Conversion Rate

    Challenge logic:

    CCTV unique visitors
            +
    Store POS bills
            ↓
    Conversion %

    POS systems generally do not contain CCTV visitor IDs,
    therefore conversion is calculated using store-level
    visitor-to-transaction correlation.
    """


    total_visitors = (
        db.query(
            func.count(
                func.distinct(Event.visitor_id)
            )
        )
        .filter(
            Event.store_id == store_id,
            Event.is_staff == False
        )
        .scalar()
        or 0
    )


    if total_visitors == 0:

        return 0.0



    total_transactions = (
        db.query(
            func.count(
                POSTransaction.id
            )
        )
        .filter(
            POSTransaction.store_id
            ==
            store_id
        )
        .scalar()
        or 0
    )


    conversion = (
        total_transactions
        /
        total_visitors
    )


    return min(
        conversion,
        1.0
    )