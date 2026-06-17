from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/restaurants", tags=["Restaurant"])


@router.get("/{restaurant_id}", response_model=schemas.RestaurantOut)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    r = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return r


@router.put("/{restaurant_id}", response_model=schemas.RestaurantOut)
def update_restaurant(
    restaurant_id: int, payload: schemas.RestaurantUpdate,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    r = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    for k, v in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.post("/{restaurant_id}/connect-whatsapp")
def connect_whatsapp(
    restaurant_id: int, whatsapp_number: str,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    r = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    r.whatsapp_number = whatsapp_number
    r.whatsapp_connected = True
    db.commit()
    return {"status": "connected", "whatsapp_number": whatsapp_number}


@router.get("/{restaurant_id}/members")
def list_members(restaurant_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    members = db.query(models.RestaurantMember).filter(
        models.RestaurantMember.restaurant_id == restaurant_id,
        models.RestaurantMember.is_active == True,
    ).all()
    result = []
    for m in members:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        result.append({
            "id": m.id, "role": m.role, "joined_at": m.joined_at,
            "user": {"id": user.id, "full_name": user.full_name, "email": user.email, "phone": user.phone} if user else None,
        })
    return result


@router.post("/{restaurant_id}/invite-member")
def invite_member(
    restaurant_id: int, email: str, role: str,
    db: Session = Depends(get_db), current_user=Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Ask them to register first.")
    existing = db.query(models.RestaurantMember).filter(
        models.RestaurantMember.restaurant_id == restaurant_id,
        models.RestaurantMember.user_id == user.id,
    ).first()
    if existing:
        existing.is_active = True
        existing.role = role
    else:
        member = models.RestaurantMember(restaurant_id=restaurant_id, user_id=user.id, role=role)
        db.add(member)
    db.commit()
    return {"status": "invited", "user": user.full_name, "role": role}
