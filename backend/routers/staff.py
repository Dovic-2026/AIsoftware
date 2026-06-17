from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/restaurants/{restaurant_id}/staff", tags=["Staff"])


@router.get("/", response_model=List[schemas.StaffMemberOut])
def list_staff(restaurant_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.StaffMember).filter(
        models.StaffMember.restaurant_id == restaurant_id,
        models.StaffMember.is_active == True,
    ).order_by(models.StaffMember.name).all()


@router.post("/", response_model=schemas.StaffMemberOut, status_code=201)
def create_staff(restaurant_id: int, payload: schemas.StaffMemberCreate,
                 db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    staff = models.StaffMember(**payload.model_dump(), restaurant_id=restaurant_id)
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.put("/{staff_id}", response_model=schemas.StaffMemberOut)
def update_staff(restaurant_id: int, staff_id: int, payload: schemas.StaffMemberCreate,
                 db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    staff = db.query(models.StaffMember).filter(
        models.StaffMember.id == staff_id, models.StaffMember.restaurant_id == restaurant_id
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(staff, k, v)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=204)
def deactivate_staff(restaurant_id: int, staff_id: int,
                     db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    staff = db.query(models.StaffMember).filter(
        models.StaffMember.id == staff_id, models.StaffMember.restaurant_id == restaurant_id
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    staff.is_active = False
    db.commit()


# ─── Attendance ───────────────────────────────────────────────────────────────

@router.post("/attendance", response_model=schemas.AttendanceOut, status_code=201)
def mark_attendance(restaurant_id: int, payload: schemas.AttendanceCreate,
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    existing = db.query(models.Attendance).filter(
        models.Attendance.staff_member_id == payload.staff_member_id,
        models.Attendance.date == payload.date,
        models.Attendance.restaurant_id == restaurant_id,
    ).first()
    if existing:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing

    attendance = models.Attendance(**payload.model_dump(), restaurant_id=restaurant_id)
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance


@router.post("/attendance/bulk", status_code=201)
def bulk_attendance(restaurant_id: int, payload: schemas.AttendanceBulkCreate,
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    results = []
    for record in payload.records:
        existing = db.query(models.Attendance).filter(
            models.Attendance.staff_member_id == record.staff_member_id,
            models.Attendance.date == payload.date,
            models.Attendance.restaurant_id == restaurant_id,
        ).first()
        if existing:
            existing.status = record.status
            existing.notes = record.notes
        else:
            att = models.Attendance(
                staff_member_id=record.staff_member_id,
                restaurant_id=restaurant_id,
                date=payload.date,
                status=record.status,
                notes=record.notes,
            )
            db.add(att)
    db.commit()
    return {"saved": len(payload.records)}


@router.get("/attendance", response_model=List[schemas.AttendanceOut])
def get_attendance(
    restaurant_id: int,
    attendance_date: Optional[date] = None,
    staff_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(models.Attendance).filter(models.Attendance.restaurant_id == restaurant_id)
    if attendance_date:
        q = q.filter(models.Attendance.date == attendance_date)
    if staff_id:
        q = q.filter(models.Attendance.staff_member_id == staff_id)
    return q.order_by(models.Attendance.date.desc()).all()


@router.get("/attendance/today-summary")
def today_attendance(restaurant_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    today = date.today()
    total_staff = db.query(models.StaffMember).filter(
        models.StaffMember.restaurant_id == restaurant_id,
        models.StaffMember.is_active == True,
    ).count()
    present = db.query(models.Attendance).filter(
        models.Attendance.restaurant_id == restaurant_id,
        models.Attendance.date == today,
        models.Attendance.status == models.AttendanceStatus.present,
    ).count()
    absent = db.query(models.Attendance).filter(
        models.Attendance.restaurant_id == restaurant_id,
        models.Attendance.date == today,
        models.Attendance.status == models.AttendanceStatus.absent,
    ).count()
    return {"date": today.isoformat(), "total": total_staff, "present": present, "absent": absent, "unmarked": total_staff - present - absent}
