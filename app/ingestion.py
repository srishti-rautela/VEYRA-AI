"""
ingestion.py — Event ingest, validation, and deduplication.

Key design decisions:
  - Idempotent by event_id: INSERT OR IGNORE (SQLite) / ON CONFLICT DO NOTHING (Postgres)
  - Partial success: malformed events are rejected with structured errors;
    well-formed events in the same batch still succeed
  - Batch limit: 500 events per request
  - Validation: full Pydantic validation before any DB write
"""

import logging
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models import Event, EventIn, IngestResponse

log = logging.getLogger(__name__)


def ingest_events(events: List[EventIn], db: Session) -> IngestResponse:
    """
    Ingest a batch of events. Returns counts of accepted, rejected, and duplicate events.
    """
    accepted = 0
    rejected = 0
    duplicate = 0
    errors: list[dict] = []

    for ev in events:
        # Check for duplicate by event_id
        existing = db.query(Event.id).filter(Event.event_id == ev.event_id).first()
        if existing:
            duplicate += 1
            continue

        # Use a savepoint so a single-event failure doesn't roll back the whole batch
        try:
            with db.begin_nested():
                db_event = Event(
                    event_id=ev.event_id,
                    store_id=ev.store_id,
                    camera_id=ev.camera_id,
                    visitor_id=ev.visitor_id,
                    event_type=ev.event_type,
                    timestamp=ev.timestamp,
                    zone_id=ev.zone_id,
                    dwell_ms=ev.dwell_ms,
                    is_staff=ev.is_staff,
                    confidence=ev.confidence,
                    queue_depth=ev.metadata.queue_depth,
                    sku_zone=ev.metadata.sku_zone,
                    session_seq=ev.metadata.session_seq,
                )
                db.add(db_event)
            accepted += 1
        except Exception as e:
            rejected += 1
            errors.append({
                "event_id": ev.event_id,
                "error": str(e),
            })
            log.warning(f"Failed to insert event {ev.event_id}: {e}")
            continue

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        log.error(f"Batch commit failed: {e}")
        # Count all as rejected
        return IngestResponse(
            accepted=0,
            rejected=len(events),
            duplicate=0,
            errors=[{"error": f"Batch commit failed: {e}"}],
        )

    return IngestResponse(
        accepted=accepted,
        rejected=rejected,
        duplicate=duplicate,
        errors=errors,
    )


def ingest_pos_transactions(csv_path: str, db: Session) -> int:
    """
    Load POS transactions from CSV.

    Supports:
    1. Internal normalized schema
    2. Real retail POS export schema

    Converts multiple product rows of same bill into one transaction.

    Used for:
    - Offline conversion rate
    - Revenue analytics
    - Basket intelligence
    """

    import csv
    from datetime import datetime, timezone
    from collections import defaultdict

    from app.models import POSTransaction

    count = 0

    try:

        with open(
            csv_path,
            "r",
            encoding="utf-8-sig"
        ) as f:

            reader = csv.DictReader(f)
            headers = reader.fieldnames or []


            # =====================================
            # CASE 1:
            # Already normalized transaction file
            # =====================================

            if "transaction_id" in headers:

                for row in reader:

                    exists = (
                        db.query(POSTransaction.id)
                        .filter(
                            POSTransaction.transaction_id
                            ==
                            row["transaction_id"]
                        )
                        .first()
                    )

                    if exists:
                        continue


                    db.add(
                        POSTransaction(

                            transaction_id=
                                row["transaction_id"],

                            store_id=
                                row.get(
                                    "store_id",
                                    "UNKNOWN"
                                ),

                            timestamp=
                                row.get(
                                    "timestamp"
                                ),

                            basket_value_inr=
                                float(
                                    row.get(
                                        "basket_value_inr",
                                        0
                                    )
                                )
                        )
                    )


                    count += 1



            # =====================================
            # CASE 2:
            # Purplle real POS export
            # =====================================

            elif "order_id" in headers:


                orders = defaultdict(
                    lambda: {
                        "amount": 0,
                        "store": None,
                        "timestamp": None,
                    }
                )


                for row in reader:


                    order_id = row.get(
                        "order_id"
                    )


                    if not order_id:
                        continue



                    # ignore returns
                    if (
                        row.get(
                            "invoice_type",
                            ""
                        ).lower()
                        != "sales"
                    ):
                        continue



                    amount = (
                        row.get("total_amount")
                        or
                        row.get("NMV")
                        or
                        0
                    )


                    try:

                        amount = float(amount)

                    except:

                        amount = 0



                    orders[order_id]["amount"] += amount



                    if not orders[order_id]["timestamp"]:


                        orders[order_id]["store"] = (
                            row.get(
                                "store_id",
                                "UNKNOWN"
                            )
                        )


                        try:

                            dt = datetime.strptime(
                                row["order_date"]
                                + " "
                                + row["order_time"],
                                "%d-%m-%Y %H:%M:%S"
                            )

                            orders[order_id]["timestamp"] = (
                                dt.isoformat()
                                + "Z"
                            )


                        except Exception:


                            orders[order_id]["timestamp"] = (
                                datetime.now(
                                    timezone.utc
                                )
                                .isoformat()
                            )



                # insert aggregated bills

                for order_id, data in orders.items():


                    exists = (
                        db.query(POSTransaction.id)
                        .filter(
                            POSTransaction.transaction_id
                            ==
                            order_id
                        )
                        .first()
                    )


                    if exists:
                        continue



                    db.add(

                        POSTransaction(

                            transaction_id=
                                order_id,

                            store_id=
                                data["store"],

                            timestamp=
                                data["timestamp"],

                            basket_value_inr=
                                round(
                                    data["amount"],
                                    2
                                )
                        )
                    )


                    count += 1



            else:

                log.error(
                    f"Unknown POS schema {headers}"
                )

                return 0



        db.commit()


        log.info(
            f"Loaded {count} POS transactions."
        )


        return count



    except Exception as e:

        db.rollback()

        log.error(
            f"POS ingestion failed: {e}"
        )

        return 0