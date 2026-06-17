from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from database import get_db
import models, schemas
from auth import get_current_user
from services.ai_service import gather_daily_metrics, generate_report_text, generate_whatsapp_summary, answer_query, try_llm_query
from services.whatsapp_service import send_whatsapp_message

router = APIRouter(prefix="/restaurants/{restaurant_id}/reports", tags=["AI Reports"])


@router.post("/generate", response_model=schemas.AIReportOut)
async def generate_report(
    restaurant_id: int,
    report_date: Optional[date] = None,
    send_whatsapp: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    target_date = report_date or date.today()

    existing = db.query(models.AIReport).filter(
        models.AIReport.restaurant_id == restaurant_id,
        models.AIReport.report_date == target_date,
        models.AIReport.report_type == "daily",
    ).first()

    metrics = gather_daily_metrics(restaurant_id, target_date, db)
    content = generate_report_text(metrics)
    summary = f"Revenue ₹{metrics['total_revenue']:,.0f} | Orders {metrics['total_orders']} | Staff {metrics['staff_present']}/{metrics['staff_total']}"

    if existing:
        existing.content = content
        existing.summary = summary
        existing.metrics = metrics
        existing.generated_at = datetime.now()
        db.commit()
        db.refresh(existing)
        report = existing
    else:
        report = models.AIReport(
            restaurant_id=restaurant_id,
            report_date=target_date,
            report_type="daily",
            content=content,
            summary=summary,
            metrics=metrics,
        )
        db.add(report)
        db.commit()
        db.refresh(report)

    if send_whatsapp:
        restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
        if restaurant and restaurant.whatsapp_number:
            wa_msg = generate_whatsapp_summary(metrics)
            await send_whatsapp_message(restaurant.whatsapp_number, wa_msg)
            report.whatsapp_sent = True
            db.commit()

    return report


@router.get("/", response_model=List[schemas.AIReportOut])
def list_reports(
    restaurant_id: int,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return db.query(models.AIReport).filter(
        models.AIReport.restaurant_id == restaurant_id,
    ).order_by(models.AIReport.report_date.desc()).limit(limit).all()


@router.get("/{report_date}", response_model=schemas.AIReportOut)
def get_report(
    restaurant_id: int, report_date: date,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    report = db.query(models.AIReport).filter(
        models.AIReport.restaurant_id == restaurant_id,
        models.AIReport.report_date == report_date,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found for this date")
    return report


@router.post("/query")
async def query_ai(
    restaurant_id: int,
    payload: schemas.AIQueryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    metrics = gather_daily_metrics(restaurant_id, date.today(), db)
    llm_answer = await try_llm_query(payload.query, metrics)
    if llm_answer:
        return {"answer": llm_answer, "source": "llm"}
    answer = answer_query(payload.query, metrics, payload.language)
    return {"answer": answer, "source": "rules", "metrics": metrics}
