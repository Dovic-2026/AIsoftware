"""
WhatsApp Webhook Router — handles incoming messages from Twilio and Meta Cloud API.
"""
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.whatsapp_service import handle_incoming_message, send_whatsapp_message
from config import settings
import hmac, hashlib, logging

router = APIRouter(prefix="/webhook/whatsapp", tags=["WhatsApp Webhook"])
logger = logging.getLogger(__name__)


# ─── Twilio Webhook ───────────────────────────────────────────────────────────

@router.post("/twilio")
async def twilio_webhook(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    from_number = str(form.get("From", "")).replace("whatsapp:+", "").replace("whatsapp:", "")
    body = str(form.get("Body", "")).strip()

    if not from_number or not body:
        return Response(content="<Response></Response>", media_type="application/xml")

    logger.info(f"[Twilio] From: {from_number} | Msg: {body[:80]}")

    try:
        reply = await handle_incoming_message(from_number, body, db)
        await send_whatsapp_message(f"whatsapp:+{from_number}", reply)
    except Exception as e:
        logger.error(f"Twilio handler error: {e}")

    return Response(content="<Response></Response>", media_type="application/xml")


# ─── Meta Cloud API Webhook ───────────────────────────────────────────────────

@router.get("/meta")
async def meta_verify(request: Request):
    """WhatsApp webhook verification (Meta)."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == settings.META_WA_VERIFY_TOKEN:
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/meta")
async def meta_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()

    try:
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        if not messages:
            return {"status": "ok"}

        msg = messages[0]
        from_number = msg.get("from", "")
        msg_type = msg.get("type", "")

        if msg_type != "text":
            return {"status": "ok"}

        text = msg.get("text", {}).get("body", "").strip()

        if not from_number or not text:
            return {"status": "ok"}

        logger.info(f"[Meta] From: {from_number} | Msg: {text[:80]}")

        reply = await handle_incoming_message(from_number, text, db)
        await send_whatsapp_message(from_number, reply)

    except Exception as e:
        logger.error(f"Meta webhook error: {e}")

    return {"status": "ok"}


# ─── Test endpoint (dev only) ─────────────────────────────────────────────────

@router.post("/test")
async def test_whatsapp(
    phone: str,
    message: str,
    db: Session = Depends(get_db),
):
    """Test the WhatsApp bot without a real phone — for development."""
    reply = await handle_incoming_message(phone, message, db)
    return {"from": phone, "message": message, "reply": reply}
