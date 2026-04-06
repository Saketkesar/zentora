from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, WebSocket, WebSocketDisconnect, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import OperationalError
from sqlalchemy.engine import make_url
import time
import base64
from passlib.hash import bcrypt
from passlib.context import CryptContext
import jwt
import os
import uuid
from typing import Any
import hashlib
try:
    import qrcode
except Exception:
    qrcode = None

from app.core.config import settings
from app.db.session import SessionLocal, Base, engine
from app.models.user import User as UserModel
from app.models.alert import Alert as AlertModel
from app.models.incident import Incident as IncidentModel
from app.models.aadhaar_verification import AadhaarVerification as AadhaarModel
from app.models.tourist_id import TouristID as TouristIDModel
from app.models.itinerary import Itinerary as ItineraryModel
from app.models.geofence import Geofence as GeofenceModel
from app.models.itinerary_plan import ItineraryPlan as ItineraryPlanModel
from app.models.user_location import UserLocation as UserLocationModel
from app.models.rfid import RFIDBinding as RFIDBindingModel
from app.models.rfid import RFIDScan as RFIDScanModel
try:
    from web3 import Web3
except Exception:
    Web3 = None  # type: ignore

app = FastAPI(title="Zentora API", version="0.2.0")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://zentora.local:3000",
    "https://zentora.local",
    "https://zentora.local:8443",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files for uploaded images and QR codes
app.mount("/static", StaticFiles(directory="data"), name="static")

# Simple in-memory subscriber set for alert broadcasts
alert_clients: set[WebSocket] = set()
rfid_clients: set[WebSocket] = set()

# RFID Module Mode State (for ESP to check)
rfid_mode_state = {
    "write_enabled": False,
    "read_enabled": False,
    "user_id": None,
    "last_updated": datetime.utcnow()
}

# RFID Last Read Result (for frontend to poll)
rfid_last_read_result = {
    "result": None,  # Will store the verify result
    "timestamp": None
}

# RFID Last Write Result (for frontend to poll)
rfid_last_write_result = {
    "uuid": None,  # UUID that was written
    "timestamp": None
}

class RegisterBody(BaseModel):
    email: str
    password: str
    name: str
    dob: str
    profession: str | None = None
    phone: str | None = None

class LoginBody(BaseModel):
    email: str
    password: str

class AlertCreate(BaseModel):
    type: Literal['sos','manual'] = 'sos'
    lat: Optional[float] = None
    lng: Optional[float] = None
    description: Optional[str] = None
    battery: Optional[int] = Field(default=None, ge=0, le=100)
    network: Optional[str] = None

class Alert(BaseModel):
    id: int
    user_id: Optional[int] = None
    type: Literal['sos','manual']
    lat: Optional[float] = None
    lng: Optional[float] = None
    description: Optional[str] = None
    battery: Optional[int] = None
    network: Optional[str] = None
    status: Literal['open','acknowledged','closed'] = 'open'
    severity: int = 5
    created_at: datetime

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)) -> Optional[UserModel]:
    if not authorization:
        return None
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != 'bearer':
            return None
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        uid = int(payload.get('sub'))
        user = db.query(UserModel).filter(UserModel.id == uid).first()
        return user
    except Exception:
        return None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def require_admin(user: Optional[UserModel] = Depends(get_current_user)) -> UserModel:
    if not user or user.role != 'admin':
        raise HTTPException(status_code=403, detail="admin_only")
    return user

def require_police(user: Optional[UserModel] = Depends(get_current_user)) -> UserModel:
    if not user or user.role not in {'police','admin'}:
        raise HTTPException(status_code=403, detail="police_only")
    return user

def _mask_name(name: Optional[str]) -> str:
    if not name:
        return "Tourist"
    parts = name.split()
    masked_parts: list[str] = []
    for p in parts:
        if len(p) <= 2:
            masked_parts.append(p[0] + "*")
        else:
            masked_parts.append(p[0] + "*"*(len(p)-2) + p[-1])
    return " ".join(masked_parts)

def _purge_expired_ids(db: Session) -> int:
    """Delete Tourist IDs whose valid_to has passed. Returns count deleted."""
    try:
        now = datetime.utcnow()
        items = db.query(TouristIDModel).filter(TouristIDModel.valid_to < now).all()
        count = 0
        for t in items:
            path = t.qr_path
            db.delete(t)
            count += 1
            try:
                if path and os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
        if count:
            db.commit()
        return count
    except Exception:
        return 0


def create_access_token(user: UserModel) -> str:
    iat = int(_now_utc().timestamp())
    exp = int((_now_utc() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp())
    payload = {"sub": str(user.id), "role": user.role, "iat": iat, "exp": exp, "typ": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


def create_refresh_token(user: UserModel) -> str:
    iat = int(_now_utc().timestamp())
    exp = int((_now_utc() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).timestamp())
    payload = {"sub": str(user.id), "iat": iat, "exp": exp, "typ": "refresh"}
    return jwt.encode(payload, settings.REFRESH_SECRET, algorithm=settings.JWT_ALG)

@app.on_event("startup")
def on_startup():
    # Ensure SQLite target directory exists (when using default local dev DB)
    if settings.DATABASE_URL.startswith("sqlite"):
        try:
            db_path = make_url(settings.DATABASE_URL).database or ""
            parent_dir = os.path.dirname(db_path)
            if parent_dir and not os.path.exists(parent_dir):
                os.makedirs(parent_dir, exist_ok=True)
        except Exception:
            # Non-fatal: continue and let SQLAlchemy raise if any real issue persists
            pass

    # wait for DB to be ready (compose race protection)
    for i in range(30):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            break
        except OperationalError:
            time.sleep(1)
    # Ensure uploads dir exists
    try:
        os.makedirs("data/uploads", exist_ok=True)
        os.makedirs("data/qr", exist_ok=True)
    except Exception:
        pass
    Base.metadata.create_all(bind=engine)
    # Minimal schema migration: ensure new columns exist on existing tables
    try:
        insp = sa_inspect(engine)
        user_cols = set(c.get('name') for c in insp.get_columns('users'))
        rfid_bind_cols = set(c.get('name') for c in insp.get_columns('rfid_bindings')) if insp.has_table('rfid_bindings') else set()
        rfid_scan_cols = set(c.get('name') for c in insp.get_columns('rfid_scans')) if insp.has_table('rfid_scans') else set()
        tourist_id_cols = set(c.get('name') for c in insp.get_columns('tourist_ids')) if insp.has_table('tourist_ids') else set()
    except Exception:
        user_cols = set()
        rfid_bind_cols = set()
        rfid_scan_cols = set()
        tourist_id_cols = set()
    try:
        with engine.begin() as conn:
            if 'profile_photo_path' not in user_cols:
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN profile_photo_path VARCHAR(255)"))
                except Exception:
                    # Ignore if cannot alter (e.g., permissions) or already exists in a race
                    pass
            if 'phone' not in user_cols:
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(30)"))
                except Exception:
                    pass
            if 'profile_photo_path' not in tourist_id_cols:
                try:
                    conn.execute(text("ALTER TABLE tourist_ids ADD COLUMN profile_photo_path VARCHAR(255)"))
                except Exception:
                    pass
            # Create RFID tables if missing (SQLite compatible minimal DDL)
            if not insp.has_table('rfid_bindings'):
                try:
                    conn.execute(text("""
                    CREATE TABLE rfid_bindings (
                        id INTEGER PRIMARY KEY,
                        user_id INTEGER,
                        tag_id VARCHAR(64) UNIQUE,
                        blockchain_id VARCHAR(128),
                        created_at DATETIME,
                        active BOOLEAN
                    )
                    """))
                except Exception:
                    pass
            if not insp.has_table('rfid_scans'):
                try:
                    conn.execute(text("""
                    CREATE TABLE rfid_scans (
                        id INTEGER PRIMARY KEY,
                        tag_id VARCHAR(64),
                        valid BOOLEAN,
                        user_id INTEGER,
                        tourist_uuid VARCHAR(64),
                        scanned_at DATETIME
                    )
                    """))
                except Exception:
                    pass
    except Exception:
        # Non-fatal: continue if inspection/alter fails
        pass
    # Seed admin and police users if missing
    try:
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        with SessionLocal() as s:
            for email, pw, role, name in [
                (settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD, 'admin', 'Admin'),
                (settings.POLICE_EMAIL, settings.POLICE_PASSWORD, 'police', 'Police'),
            ]:
                if not email or not pw:
                    continue
                u = s.query(UserModel).filter(UserModel.email == email).first()
                if not u:
                    s.add(UserModel(email=email, password_hash=pwd.hash(pw), name=name, role=role))
                    s.commit()
                else:
                    changed = False
                    if u.role != role:
                        u.role = role
                        changed = True
                    # Ensure known password for local dev
                    try:
                        from passlib.hash import bcrypt as _bcrypt
                        if not _bcrypt.verify(pw, u.password_hash):
                            u.password_hash = pwd.hash(pw)
                            changed = True
                    except Exception:
                        # If verification fails, set password
                        u.password_hash = pwd.hash(pw)
                        changed = True
                    if changed:
                        s.add(u)
                        s.commit()
    except Exception:
        # Non-fatal: continue if seeding fails in production
        pass

# Periodic cleanup of expired tourist IDs using a native asyncio task
@app.on_event("startup")
async def _start_periodic_cleanup_task():
    import asyncio

    async def _loop():
        # wait a bit on startup to avoid racing with migrations/seeding
        await asyncio.sleep(10)
        while True:
            try:
                with SessionLocal() as s:
                    _purge_expired_ids(s)
            except Exception:
                pass
            # run every 5 minutes
            await asyncio.sleep(300)

    # store the task so we can cancel it on shutdown
    app.state._cleanup_task = asyncio.create_task(_loop())


@app.on_event("shutdown")
async def _stop_periodic_cleanup_task():
    task = getattr(app.state, "_cleanup_task", None)
    if task:
        try:
            task.cancel()
            await task
        except Exception:
            pass

@app.get("/api/status")
async def status():
    return {"status": "ok", "blockchain": "offline", "db": "ok", "ai": "idle"}

@app.post("/api/auth/register")
async def register(body: RegisterBody, db: Session = Depends(get_db)):
    # minimal: create user if not exists
    existing = db.query(UserModel).filter(UserModel.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="email exists")
    user = UserModel(
        email=body.email,
        password_hash=bcrypt.hash(body.password),
        name=body.name,
        role='tourist',
        
    )
    if body.phone:
        user.phone = body.phone
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user_id": user.id, "status": "pending"}

@app.post("/api/auth/login")
async def login(body: LoginBody, db: Session = Depends(get_db)):
    user: UserModel | None = db.query(UserModel).filter(UserModel.email == body.email).first()
    if not user or not bcrypt.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")
    token = create_access_token(user)
    refresh = create_refresh_token(user)
    return {"access_token": token, "refresh_token": refresh, "role": user.role}


class RefreshBody(BaseModel):
    refresh_token: str


@app.post("/api/auth/refresh")
async def refresh(body: RefreshBody, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.refresh_token, settings.REFRESH_SECRET, algorithms=[settings.JWT_ALG])
        if payload.get("typ") != "refresh":
            raise HTTPException(status_code=400, detail="invalid token type")
        uid = int(payload.get("sub"))
        user = db.query(UserModel).filter(UserModel.id == uid).first()
        if not user:
            raise HTTPException(status_code=404, detail="user not found")
        new_access = create_access_token(user)
        return {"access_token": new_access, "role": user.role}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="refresh expired")
    except Exception:
        raise HTTPException(status_code=400, detail="invalid refresh token")

@app.get("/api/tourist/me")
async def me(db: Session = Depends(get_db), user: Optional[UserModel] = Depends(get_current_user)):
    # purge expired IDs opportunistically
    try:
        _purge_expired_ids(db)
    except Exception:
        pass
    # Return minimal info, no PII
    tid = None
    if user is not None:
        tid = db.query(TouristIDModel).filter(TouristIDModel.user_id == user.id).order_by(TouristIDModel.created_at.desc()).first()
    # KYC status for current user if available
    kyc_status = None
    if user is not None:
        rec = db.query(AadhaarModel).filter(AadhaarModel.user_id == user.id).order_by(AadhaarModel.created_at.desc()).first()
        if rec:
            kyc_status = rec.status
    qr_url = None
    valid_from = None
    valid_to = None
    if tid and tid.qr_path:
        fname = os.path.basename(tid.qr_path)
        qr_url = f"/static/qr/{fname}"
        valid_from = tid.valid_from.isoformat()+"Z" if tid.valid_from else None
        valid_to = tid.valid_to.isoformat()+"Z" if tid.valid_to else None
    profile_photo_url = None
    name = user.name if user else None
    # Prefer profile photo from tourist ID if available, otherwise use user profile photo
    if tid and tid.profile_photo_path:
        p = os.path.basename(tid.profile_photo_path)
        profile_photo_url = f"/static/uploads/{p}"
    elif user and user.profile_photo_path:
        p = os.path.basename(user.profile_photo_path)
        profile_photo_url = f"/static/uploads/{p}"
    return {"tourist_id": getattr(tid, 'uuid', None), "qr_url": qr_url, "valid_from": valid_from, "valid_to": valid_to, "safety_score": 0, "kyc_status": kyc_status, "name": name, "profile_photo_url": profile_photo_url}

@app.post("/api/alerts")
async def create_alert(payload: AlertCreate, db: Session = Depends(get_db)):
    alert = AlertModel(
        user_id=None,
        type=payload.type,
        lat=payload.lat,
        lng=payload.lng,
        description=payload.description,
        battery=payload.battery,
        network=payload.network,
        status='open',
        severity=5,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    # Broadcast to connected clients
    data = {
        "id": alert.id,
        "type": alert.type,
        "lat": alert.lat,
        "lng": alert.lng,
        "status": alert.status,
        "severity": alert.severity,
        "created_at": alert.created_at.isoformat()+"Z",
    }
    dead: list[WebSocket] = []
    for ws in alert_clients:
        try:
            await ws.send_json({"event": "alert_created", "data": data})
        except Exception:
            dead.append(ws)
    for ws in dead:
        try:
            alert_clients.discard(ws)
        except Exception:
            pass
    return {"alert_id": alert.id, "notify": True}

@app.websocket("/ws/alerts")
async def ws_alerts(ws: WebSocket):
    await ws.accept()
    alert_clients.add(ws)
    try:
        while True:
            # Keep alive; we don't expect client messages
            await ws.receive_text()
    except WebSocketDisconnect:
        alert_clients.discard(ws)
    except Exception:
        alert_clients.discard(ws)

class AlertStatusBody(BaseModel):
    action: Literal['acknowledge','close']

def _alert_to_dict(a: AlertModel):
    return {
        "id": a.id, "user_id": a.user_id, "type": a.type, "lat": a.lat, "lng": a.lng,
        "description": a.description, "battery": a.battery, "network": a.network,
        "status": a.status, "severity": a.severity, "created_at": a.created_at.isoformat()+"Z"
    }

@app.post("/api/alerts/{alert_id}/status")
async def update_alert_status(alert_id: int, body: AlertStatusBody, db: Session = Depends(get_db)):
    a = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="not found")
    if body.action == 'acknowledge' and a.status == 'open':
        a.status = 'acknowledged'
    elif body.action == 'close':
        a.status = 'closed'
    db.add(a)
    db.commit()
    data = _alert_to_dict(a)
    dead: list[WebSocket] = []
    for ws in alert_clients:
        try:
            await ws.send_json({"event": "alert_updated", "data": data})
        except Exception:
            dead.append(ws)
    for ws in dead:
        try:
            alert_clients.discard(ws)
        except Exception:
            pass
    return {"ok": True, "status": a.status}

@app.post("/api/incidents")
async def create_incident(
    description: str = Form(default=""),
    lat: Optional[float] = Form(default=None),
    lng: Optional[float] = Form(default=None),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    photo_path: Optional[str] = None
    # Ensure upload directory exists
    try:
        os.makedirs("data/uploads", exist_ok=True)
    except Exception:
        pass
    if image is not None:
        safe_name = f"inc_{int(time.time())}_{image.filename}"
        dest = os.path.join("data/uploads", safe_name)
        with open(dest, "wb") as f:
            f.write(await image.read())
        photo_path = dest
    inc = IncidentModel(description=description, lat=lat, lng=lng, photo_path=photo_path, status='open')
    db.add(inc)
    db.commit()
    db.refresh(inc)
    # Broadcast to connected clients as an incident event
    photo_url = (f"/static/uploads/{os.path.basename(inc.photo_path)}" if inc.photo_path else None)
    data = {"id": inc.id, "lat": inc.lat, "lng": inc.lng, "description": inc.description, "photo_url": photo_url, "status": inc.status, "created_at": inc.created_at.isoformat()+"Z"}
    dead: list[WebSocket] = []
    for ws in alert_clients:
        try:
            await ws.send_json({"event": "incident_created", "data": data})
        except Exception:
            dead.append(ws)
    for ws in dead:
        try:
            alert_clients.discard(ws)
        except Exception:
            pass
    return {"incident_id": inc.id, "status": inc.status}

@app.get("/api/admin/incidents")
async def list_incidents(status: Optional[str] = None, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    q = db.query(IncidentModel)
    if status:
        q = q.filter(IncidentModel.status == status)
    items = q.order_by(IncidentModel.created_at.desc()).all()
    return {"items": [
        {"id": i.id, "lat": i.lat, "lng": i.lng, "description": i.description, "photo_url": (f"/static/uploads/{os.path.basename(i.photo_path)}" if i.photo_path else None), "status": i.status, "created_at": i.created_at.isoformat()+"Z"}
        for i in items
    ]}

# Police-readable incidents list (same payload as admin)
@app.get("/api/police/incidents")
async def police_list_incidents(status: Optional[str] = None, db: Session = Depends(get_db), _: UserModel = Depends(require_police)):
    q = db.query(IncidentModel)
    if status:
        q = q.filter(IncidentModel.status == status)
    items = q.order_by(IncidentModel.created_at.desc()).all()
    return {"items": [
        {"id": i.id, "lat": i.lat, "lng": i.lng, "description": i.description, "photo_url": (f"/static/uploads/{os.path.basename(i.photo_path)}" if i.photo_path else None), "status": i.status, "created_at": i.created_at.isoformat()+"Z"}
        for i in items
    ]}

# Admin: search verified users
@app.get("/api/admin/users/verified")
async def search_verified_users(q: Optional[str] = None, user_id: Optional[int] = None, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    query = db.query(UserModel).filter(UserModel.aadhaar_verified == True)  # noqa: E712
    if user_id:
        query = query.filter(UserModel.id == user_id)
    if q:
        like = f"%{q}%"
        try:
            from sqlalchemy import or_
            query = query.filter(or_(UserModel.name.ilike(like), UserModel.email.ilike(like), UserModel.phone.ilike(like)))
        except Exception:
            pass
    users = query.order_by(UserModel.name.asc()).limit(50).all()
    return {"items": [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "profile_photo_url": (f"/static/uploads/{os.path.basename(u.profile_photo_path)}" if u.profile_photo_path else None)
        } for u in users
    ]}

# Admin: list tourist IDs
@app.get("/api/admin/tourist-ids")
async def list_tourist_ids(user_id: Optional[int] = None, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    # purge expired before listing to keep data fresh
    try:
        _purge_expired_ids(db)
    except Exception:
        pass
    q = db.query(TouristIDModel)
    if user_id:
        q = q.filter(TouristIDModel.user_id == user_id)
    items = q.order_by(TouristIDModel.created_at.desc()).limit(100).all()
    return {"items": [
        {
            "id": t.id,
            "user_id": t.user_id,
            "uuid": t.uuid,
            "qr_url": (f"/static/qr/{os.path.basename(t.qr_path)}" if t.qr_path else None),
            "valid_from": (t.valid_from.isoformat()+"Z" if t.valid_from else None),
            "valid_to": (t.valid_to.isoformat()+"Z" if t.valid_to else None),
            "created_at": (t.created_at.isoformat()+"Z" if t.created_at else None),
        } for t in items
    ]}

@app.get("/api/admin/alerts")
async def admin_alerts(status: Optional[str] = None, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    if status and status not in {"open","acknowledged","closed"}:
        raise HTTPException(status_code=400, detail="invalid status")
    q = db.query(AlertModel)
    if status:
        q = q.filter(AlertModel.status == status)
    items = q.order_by(AlertModel.created_at.desc()).all()
    return {"items": [
        {
            "id": a.id, "user_id": a.user_id, "type": a.type, "lat": a.lat, "lng": a.lng,
            "description": a.description, "battery": a.battery, "network": a.network,
            "status": a.status, "severity": a.severity, "created_at": a.created_at.isoformat()+"Z"
        } for a in items
    ]}

# Aadhaar KYC upload by tourist
@app.post("/api/kyc/aadhaar")
async def upload_aadhaar(front: UploadFile = File(...), back: UploadFile = File(...), db: Session = Depends(get_db), user: Optional[UserModel] = Depends(get_current_user)):
    async def save_upload(prefix: str, f: UploadFile) -> str:
        safe = f"{prefix}_{int(time.time())}_{f.filename}"
        path = os.path.join("data/uploads", safe)
        data = await f.read()
        with open(path, "wb") as out:
            out.write(data)
        return path
    front_path = await save_upload("front", front)
    back_path = await save_upload("back", back)
    rec = AadhaarModel(front_path=front_path, back_path=back_path, status='pending', user_id=(user.id if user else None))
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return {"verification_id": rec.id, "status": rec.status}

# Admin: list pending KYC
@app.get("/api/admin/kyc/pending")
async def list_pending_kyc(db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    items = db.query(AadhaarModel).filter(AadhaarModel.status == 'pending').order_by(AadhaarModel.created_at.asc()).all()
    return {"items": [{"id": r.id, "user_id": r.user_id, "front_path": r.front_path, "back_path": r.back_path, "status": r.status, "created_at": r.created_at.isoformat()+"Z"} for r in items]}

class KycDecision(BaseModel):
    action: Literal['approve','reject']
    valid_days: Optional[int] = 30
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None

# Admin: approve/reject KYC (no Tourist ID issuance here)
@app.post("/api/admin/kyc/{verification_id}/decision")
async def decide_kyc(verification_id: int, body: KycDecision, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    rec = db.query(AadhaarModel).filter(AadhaarModel.id == verification_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    
    if body.action == 'reject':
        rec.status = 'rejected'
        db.add(rec)
        db.flush()
        db.commit()
        return {"status": rec.status, "message": "KYC rejected"}
    
    # approve => only mark verified on the user; NO tourist ID issuance here
    if body.action == 'approve':
        rec.status = 'approved'
        db.add(rec)
        db.flush()
        
        if rec.user_id:
            u = db.query(UserModel).filter(UserModel.id == rec.user_id).first()
            if u:
                u.aadhaar_verified = True
                db.add(u)
        
        db.commit()
        return {"status": rec.status, "message": "KYC approved successfully"}
    
    raise HTTPException(status_code=400, detail="Invalid action")

# Admin: upload tourist profile photo (like KYC capture but single image)
@app.post("/api/admin/users/{user_id}/profile-photo")
async def upload_profile_photo(user_id: int, photo: UploadFile = File(...), db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    safe_name = f"profile_{user_id}_{int(time.time())}_{photo.filename}"
    dest = os.path.join("data/uploads", safe_name)
    with open(dest, "wb") as f:
        f.write(await photo.read())
    user.profile_photo_path = dest
    db.add(user)
    db.commit()
    return {"ok": True, "path": dest}

class TouristIdBody(BaseModel):
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    profile_photo: Optional[str] = None  # base64 encoded image

@app.post("/api/admin/users/{user_id}/tourist-id")
async def create_tourist_id(user_id: int, body: TouristIdBody, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    uid = uuid.uuid4().hex
    qr_file = os.path.join("data/qr", f"{uid}.png")
    if qrcode:
        # encode the uuid itself inside the QR (tourist id)
        img = qrcode.make(uid)
        img.save(qr_file)
    else:
        with open(qr_file, 'wb') as f:
            # minimal placeholder if qrcode lib not installed
            f.write(b'')
    
    # Save profile photo if provided
    profile_photo_path = None
    if body.profile_photo:
        try:
            # Decode base64 image
            img_data = base64.b64decode(body.profile_photo)
            profile_photo_path = os.path.join("data/uploads", f"profile_{uid}.jpg")
            os.makedirs("data/uploads", exist_ok=True)
            with open(profile_photo_path, 'wb') as f:
                f.write(img_data)
        except Exception as e:
            print(f"Failed to save profile photo: {e}")
    
    vf = body.valid_from or datetime.utcnow()
    vt = body.valid_to or (vf + timedelta(days=30))
    tid = TouristIDModel(user_id=user_id, uuid=uid, qr_path=qr_file, profile_photo_path=profile_photo_path, valid_from=vf, valid_to=vt)
    db.add(tid)
    db.commit()
    return {"uuid": uid, "qr_path": qr_file, "profile_photo_path": profile_photo_path, "valid_from": vf.isoformat()+"Z", "valid_to": vt.isoformat()+"Z"}

@app.delete("/api/admin/users/{user_id}/tourist-id")
async def delete_tourist_id(user_id: int, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    tid = db.query(TouristIDModel).filter(TouristIDModel.user_id == user_id).order_by(TouristIDModel.created_at.desc()).first()
    if not tid:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(tid)
    db.commit()
    try:
        if tid.qr_path and os.path.exists(tid.qr_path):
            os.remove(tid.qr_path)
    except Exception:
        pass
    return {"ok": True}

@app.delete("/api/admin/tourist-ids/{tid}")
async def admin_delete_tourist_id(tid: int, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    # purge expired first to avoid deleting stale ones
    try:
        _purge_expired_ids(db)
    except Exception:
        pass
    rec = db.query(TouristIDModel).filter(TouristIDModel.id == tid).first()
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    path = rec.qr_path
    db.delete(rec)
    db.commit()
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
    return {"ok": True}

@app.get("/api/police/sos")
async def police_sos(status: Optional[str] = 'open', db: Session = Depends(get_db), _: UserModel = Depends(require_police)):
    q = db.query(AlertModel).filter(AlertModel.type == 'sos')
    if status:
        q = q.filter(AlertModel.status == status)
    items = q.order_by(AlertModel.created_at.desc()).all()
    return {"items": [
        {
            "id": a.id, "user_id": a.user_id, "type": a.type, "lat": a.lat, "lng": a.lng,
            "description": a.description, "battery": a.battery, "network": a.network,
            "status": a.status, "severity": a.severity, "created_at": a.created_at.isoformat()+"Z"
        } for a in items
    ]}

# Admin broadcast notification to all connected clients
class NotifyBody(BaseModel):
    message: str

@app.post("/api/admin/notify")
async def admin_notify(body: NotifyBody, _: UserModel = Depends(require_admin)):
    dead: list[WebSocket] = []
    for ws in alert_clients:
        try:
            await ws.send_json({"event": "notice", "data": {"message": body.message}})
        except Exception:
            dead.append(ws)
    for ws in dead:
        try:
            alert_clients.discard(ws)
        except Exception:
            pass
    return {"ok": True}

# Geofences CRUD (minimal)
class GeofenceBody(BaseModel):
    name: str
    lat: float
    lng: float
    radius_m: float
    kind: Literal['safe','unsafe'] = 'safe'

@app.post("/api/admin/geofences")
async def add_geofence(body: GeofenceBody, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    g = GeofenceModel(name=body.name, lat=body.lat, lng=body.lng, radius_m=body.radius_m, kind=body.kind)
    db.add(g)
    db.commit()
    db.refresh(g)
    return {"id": g.id}

@app.get("/api/admin/geofences")
async def list_geofences(db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    items = db.query(GeofenceModel).all()
    return {"items": [ {"id": x.id, "name": x.name, "lat": x.lat, "lng": x.lng, "radius_m": x.radius_m, "kind": x.kind} for x in items ]}

# Itineraries
class ItineraryBody(BaseModel):
    user_id: Optional[int] = None
    title: str
    when: datetime
    lat: Optional[float] = None
    lng: Optional[float] = None

@app.post("/api/admin/itineraries")
async def add_itinerary(body: ItineraryBody, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    it = ItineraryModel(user_id=body.user_id, title=body.title, when=body.when, lat=body.lat, lng=body.lng)
    db.add(it)
    db.commit()
    db.refresh(it)
    return {"id": it.id}

@app.get("/api/admin/itineraries")
async def list_itineraries(db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    items = db.query(ItineraryModel).order_by(ItineraryModel.when.asc()).all()
    return {"items": [ {"id": i.id, "user_id": i.user_id, "title": i.title, "when": i.when.isoformat()+"Z", "lat": i.lat, "lng": i.lng } for i in items ]}

@app.get("/api/tourist/itinerary")
async def my_itinerary(db: Session = Depends(get_db), user: Optional[UserModel] = Depends(get_current_user)):
    if not user:
        return {"items": []}
    items = db.query(ItineraryModel).filter(ItineraryModel.user_id == user.id).order_by(ItineraryModel.when.asc()).all()
    return {"items": [ {"id": i.id, "title": i.title, "when": i.when.isoformat()+"Z", "lat": i.lat, "lng": i.lng } for i in items ]}
 
# Itinerary Plans (route + checkpoints)
class ItineraryPlanBody(BaseModel):
    title: str
    data: Any

@app.post("/api/admin/itinerary-plans")
async def create_itinerary_plan(body: ItineraryPlanBody, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    # basic validation and normalization
    try:
        d = body.data or {}
        if not isinstance(d, dict):
            raise ValueError('data must be object')
        path = d.get('path') or []
        if not isinstance(path, list) or len(path) < 2:
            raise ValueError('path must contain at least 2 points')
        def to_point(p: Any):
            return { 'lat': float(p.get('lat')), 'lng': float(p.get('lng')) }
        d['path'] = [to_point(p) for p in path]
        d['start'] = d.get('start') or to_point(d['path'][0])
        d['end'] = d.get('end') or to_point(d['path'][-1])
        cps = d.get('checkpoints') or []
        if isinstance(cps, list):
            norm_cps = []
            for c in cps:
                try:
                    norm_cps.append({ 'name': str(c.get('name') or ''), 'lat': float(c.get('lat')), 'lng': float(c.get('lng')) })
                except Exception:
                    pass
            d['checkpoints'] = norm_cps
    except Exception:
        return { 'ok': False, 'error': 'invalid_data' }
    import json
    rec = ItineraryPlanModel(title=body.title, data=json.dumps(d))
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return { 'id': rec.id }

@app.get("/api/admin/itinerary-plans")
async def list_itinerary_plans(db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    import json
    items = db.query(ItineraryPlanModel).order_by(ItineraryPlanModel.created_at.desc()).all()
    return { 'items': [ { 'id': r.id, 'title': r.title, 'data': json.loads(r.data), 'created_at': r.created_at.isoformat()+"Z" } for r in items ] }

@app.get("/api/admin/itinerary-plans/{pid}")
async def get_itinerary_plan(pid: int, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    import json
    r = db.query(ItineraryPlanModel).filter(ItineraryPlanModel.id == pid).first()
    if not r:
        return { 'error': 'not_found' }
    return { 'id': r.id, 'title': r.title, 'data': json.loads(r.data), 'created_at': r.created_at.isoformat()+"Z" }

@app.delete("/api/admin/itinerary-plans/{pid}")
async def delete_itinerary_plan(pid: int, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    r = db.query(ItineraryPlanModel).filter(ItineraryPlanModel.id == pid).first()
    if not r:
        return { 'ok': False }
    db.delete(r)
    db.commit()
    return { 'ok': True }

# Public read-only itinerary plans for tourists
@app.get("/api/itinerary-plans")
async def public_list_plans(db: Session = Depends(get_db)):
    import json
    items = db.query(ItineraryPlanModel).order_by(ItineraryPlanModel.created_at.desc()).all()
    return { 'items': [ { 'id': r.id, 'title': r.title, 'data': json.loads(r.data) } for r in items ] }

@app.get("/api/itinerary-plans/{pid}")
async def public_get_plan(pid: int, db: Session = Depends(get_db)):
    import json
    r = db.query(ItineraryPlanModel).filter(ItineraryPlanModel.id == pid).first()
    if not r:
        return { 'error': 'not_found' }
    return { 'id': r.id, 'title': r.title, 'data': json.loads(r.data) }

@app.get("/api/itinerary-plans/{pid}.geojson")
async def export_plan_geojson(pid: int, db: Session = Depends(get_db)):
    import json
    r = db.query(ItineraryPlanModel).filter(ItineraryPlanModel.id == pid).first()
    if not r:
        return { 'error': 'not_found' }
    d = json.loads(r.data)
    features = []
    if d.get('path'):
        coords = [[p['lng'], p['lat']] for p in d['path']]
        features.append({ 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': coords }, 'properties': { 'title': r.title } })
    for cp in d.get('checkpoints', []):
        features.append({ 'type': 'Feature', 'geometry': { 'type': 'Point', 'coordinates': [cp['lng'], cp['lat']] }, 'properties': { 'name': cp.get('name','') } })
    return { 'type': 'FeatureCollection', 'features': features }

@app.get("/api/itinerary-plans/{pid}.gpx")
async def export_plan_gpx(pid: int, db: Session = Depends(get_db)):
    import json
    r = db.query(ItineraryPlanModel).filter(ItineraryPlanModel.id == pid).first()
    if not r:
        return { 'error': 'not_found' }
    d = json.loads(r.data)
    # Very simple GPX (route + waypoints)
    gpx_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="Zentora" xmlns="http://www.topografix.com/GPX/1/1">',
    ]
    if d.get('checkpoints'):
        for cp in d['checkpoints']:
            gpx_parts.append(f"<wpt lat=\"{cp['lat']}\" lon=\"{cp['lng']}\"><name>{cp.get('name','')}</name></wpt>")
    if d.get('path'):
        gpx_parts.append('<rte>')
        for p in d['path']:
            gpx_parts.append(f"<rtept lat=\"{p['lat']}\" lon=\"{p['lng']}\" />")
        gpx_parts.append('</rte>')
    gpx_parts.append('</gpx>')
    return { 'gpx': '\n'.join(gpx_parts) }

# User locations (heartbeat)
class LocationBody(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None

@app.post("/api/locations/update")
async def update_location(body: LocationBody, db: Session = Depends(get_db), user: Optional[UserModel] = Depends(get_current_user)):
    if not user:
        return {"ok": False}
    rec = db.query(UserLocationModel).filter(UserLocationModel.user_id == user.id).first()
    if not rec:
        rec = UserLocationModel(user_id=user.id, lat=body.lat, lng=body.lng, updated_at=datetime.utcnow())
    else:
        rec.lat = body.lat
        rec.lng = body.lng
        rec.updated_at = datetime.utcnow()
    db.add(rec)
    db.commit()
    return {"ok": True}

@app.get("/api/admin/users/locations")
async def list_user_locations(db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    items = db.query(UserLocationModel).all()
    return {"items": [ {"user_id": u.user_id, "lat": u.lat, "lng": u.lng, "updated_at": u.updated_at.isoformat()+"Z" } for u in items ]}

# Public heatmap: anonymized user locations (rounded) for tourists and admin maps
@app.get("/api/heat/users")
async def public_user_heat(db: Session = Depends(get_db)):
    items = db.query(UserLocationModel).all()
    pts: list[dict[str, float]] = []
    for u in items:
        if u.lat is None or u.lng is None:
            continue
        # round to ~4 decimals (~11m) to avoid exposing exact positions
        lat = round(float(u.lat), 4)
        lng = round(float(u.lng), 4)
        pts.append({ "lat": lat, "lng": lng })
    return { "points": pts }

# Public: lookup a tourist by UUID and return masked details and validity window
@app.get("/api/public/tourist")
async def public_tourist(uuid: str, db: Session = Depends(get_db)):
    if not uuid:
        raise HTTPException(status_code=400, detail="missing_uuid")
    uid = uuid.strip()
    if uid.lower().startswith('0x'):
        uid = uid[2:]
    uid = uid.lower()
    tid = db.query(TouristIDModel).filter(TouristIDModel.uuid == uid).order_by(TouristIDModel.created_at.desc()).first()
    if not tid:
        raise HTTPException(status_code=404, detail="not_found")
    brief = _tourist_brief(db, tid.user_id)
    # Do not expose raw user_id in public endpoint
    brief.pop('user_id', None)
    return brief

# Police/Admin: get full tourist details by UUID (for QR scanning)
@app.get("/api/police/tourist")
async def police_tourist_details(uuid: str = Query(None), db: Session = Depends(get_db), _: UserModel = Depends(require_police)):
    if not uuid or not uuid.strip():
        raise HTTPException(status_code=400, detail="missing_uuid")
    uid = uuid.strip().lower()
    if uid.startswith('0x'):
        uid = uid[2:]
    try:
        tid = db.query(TouristIDModel).filter(TouristIDModel.uuid == uid).order_by(TouristIDModel.created_at.desc()).first()
        if not tid:
            raise HTTPException(status_code=404, detail=f"tourist_id_not_found for uuid {uid}")
        u = db.query(UserModel).filter(UserModel.id == tid.user_id).first()
        if not u:
            raise HTTPException(status_code=404, detail="user_not_found")
        # Get KYC documents
        kyc_docs = db.query(AadhaarModel).filter(AadhaarModel.user_id == u.id).all()
        kyc_documents = [
            {
                "document_type": "Aadhaar",
                "front_url": f"/static/uploads/{os.path.basename(doc.front_path)}" if doc.front_path else None,
                "back_url": f"/static/uploads/{os.path.basename(doc.back_path)}" if doc.back_path else None,
                "status": doc.status
            } for doc in kyc_docs
        ]
        return {
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "tourist_id": getattr(tid, 'uuid', None),
            "kyc_status": u.aadhaar_verified and 'approved' or 'pending',
            "profile_photo_url": f"/static/uploads/{os.path.basename(u.profile_photo_path)}" if u.profile_photo_path else None,
            "kyc_documents": kyc_documents,
            "valid_from": tid.valid_from.isoformat()+"Z" if tid.valid_from else None,
            "valid_to": tid.valid_to.isoformat()+"Z" if tid.valid_to else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"error: {str(e)}")

# Debug endpoint: check if UUID exists (no auth required)
@app.get("/api/debug/tourist-exists")
async def debug_tourist_exists(uuid: str = Query(None), db: Session = Depends(get_db)):
    if not uuid or not uuid.strip():
        return {"exists": False, "reason": "no_uuid_provided"}
    uid = uuid.strip().lower()
    if uid.startswith('0x'):
        uid = uid[2:]
    tid = db.query(TouristIDModel).filter(TouristIDModel.uuid == uid).first()
    if tid:
        u = db.query(UserModel).filter(UserModel.id == tid.user_id).first()
        return {"exists": True, "user_name": u.name if u else "unknown", "user_id": tid.user_id}
    # Check if any tourist IDs exist at all
    count = db.query(TouristIDModel).count()
    return {"exists": False, "reason": f"uuid_not_found (total_tourist_ids: {count})", "searched_uuid": uid}

# Admin: aggregate stats for dashboard
@app.get("/api/admin/stats")
async def admin_stats(db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    now = datetime.utcnow()
    active_since = now - timedelta(minutes=5)
    # purge expired so totals reflect current state
    try:
        _purge_expired_ids(db)
    except Exception:
        pass
    total_users = db.query(UserModel).count()
    total_tourists = db.query(UserModel).filter(UserModel.role == 'tourist').count()
    total_admins = db.query(UserModel).filter(UserModel.role == 'admin').count()
    total_police = db.query(UserModel).filter(UserModel.role == 'police').count()
    verified_tourists = db.query(UserModel).filter(UserModel.role == 'tourist', UserModel.aadhaar_verified == True).count()  # noqa: E712
    total_ids = db.query(TouristIDModel).count()
    pending_kyc = db.query(AadhaarModel).filter(AadhaarModel.status == 'pending').count()
    active_users_5m = db.query(UserLocationModel).filter(UserLocationModel.updated_at >= active_since).count()
    # richer metrics
    ids_last_24h = db.query(TouristIDModel).filter(TouristIDModel.created_at >= (now - timedelta(hours=24))).count()
    kyc_approved = db.query(AadhaarModel).filter(AadhaarModel.status == 'approved').count()
    kyc_rejected = db.query(AadhaarModel).filter(AadhaarModel.status == 'rejected').count()
    # tourists with/without any ID
    try:
        from sqlalchemy import distinct
        tourists_with_id = db.query(distinct(TouristIDModel.user_id)).count()
    except Exception:
        tourists_with_id = 0
    tourists_without_id = max(0, total_tourists - tourists_with_id)
    return {
        "total_users": total_users,
        "total_tourists": total_tourists,
        "total_admins": total_admins,
        "total_police": total_police,
        "verified_tourists": verified_tourists,
        "total_ids": total_ids,
        "pending_kyc": pending_kyc,
        "active_users_5m": active_users_5m,
        "active_window_minutes": 5,
        "ids_last_24h": ids_last_24h,
        "kyc_approved": kyc_approved,
        "kyc_rejected": kyc_rejected,
        "tourists_with_ids": tourists_with_id,
        "tourists_without_ids": tourists_without_id,
    }

# Admin: tourist users summary with latest Tourist ID (limited)
@app.get("/api/admin/users/summary")
async def admin_users_summary(limit: int = 50, offset: int = 0, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    if limit > 200:
        limit = 200
    users = db.query(UserModel).filter(UserModel.role == 'tourist').order_by(UserModel.id.desc()).offset(offset).limit(limit).all()
    items: list[dict[str, Any]] = []
    for u in users:
        tid = db.query(TouristIDModel).filter(TouristIDModel.user_id == u.id).order_by(TouristIDModel.created_at.desc()).first()
        # latest RFID binding (if any)
        rfid = db.query(RFIDBindingModel).filter(RFIDBindingModel.user_id == u.id).order_by(RFIDBindingModel.created_at.desc()).first()
        items.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "aadhaar_verified": u.aadhaar_verified,
            "profile_photo_url": (f"/static/uploads/{os.path.basename(u.profile_photo_path)}" if u.profile_photo_path else None),
            "rfid_tag_id": getattr(rfid, 'tag_id', None),
            "rfid_blockchain_id": getattr(rfid, 'blockchain_id', None),
            "latest_tourist_id": {
                "uuid": getattr(tid, 'uuid', None),
                "valid_from": (tid.valid_from.isoformat()+"Z" if getattr(tid, 'valid_from', None) else None),
                "valid_to": (tid.valid_to.isoformat()+"Z" if getattr(tid, 'valid_to', None) else None),
                "created_at": (tid.created_at.isoformat()+"Z" if getattr(tid, 'created_at', None) else None),
                "id": getattr(tid, 'id', None),
            } if tid else None,
        })
    return {"items": items}

# ---------------- RFID: Bind, Verify, Live Feed ----------------
class RFIDBindBody(BaseModel):
    user_id: int
    tag_id: str
    blockchain_id: Optional[str] = None

class RFIDVerifyBody(BaseModel):
    tag_id: Optional[str] = None
    tourist_uuid: Optional[str] = None
    blockchain_id: Optional[str] = None

# ========== ESP32/ESP8266 RFID READ/WRITE ENDPOINTS ==========

@app.get("/api/rfid/write/get-uuid")
async def rfid_get_uuid_to_write(user_id: int = None, db: Session = Depends(get_db)):
    """
    ESP32 calls this to get the UUID to write on the RFID card
    Returns the latest Tourist ID UUID for the user
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id_required")
    
    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="user_not_found")
    
    # Get latest Tourist ID
    tid = db.query(TouristIDModel).filter(TouristIDModel.user_id == user_id).order_by(TouristIDModel.created_at.desc()).first()
    if not tid:
        raise HTTPException(status_code=404, detail="no_tourist_id")
    
    return {
        "ok": True,
        "uuid": tid.uuid,
        "user_name": u.name,
        "user_email": u.email
    }

@app.post("/api/rfid/read/verify")
async def rfid_read_verify(body: RFIDVerifyBody, db: Session = Depends(get_db)):
    """
    ESP32 calls this after reading RFID card to verify the data
    Returns full tourist info if valid
    Used for READ popup to show user details
    """
    tag: Optional[str] = (body.tag_id or "").strip().upper() if body.tag_id else None
    tourist_uuid_raw = (body.tourist_uuid or "").strip() if body.tourist_uuid else None
    blockchain_id = (body.blockchain_id or "").strip() if getattr(body, 'blockchain_id', None) else None

    if not tag and not tourist_uuid_raw and not blockchain_id:
        raise HTTPException(status_code=400, detail="missing_data")

    tourist_uuid: Optional[str] = None
    if tourist_uuid_raw:
        tourist_uuid = tourist_uuid_raw[2:] if tourist_uuid_raw.lower().startswith("0x") else tourist_uuid_raw
        tourist_uuid = tourist_uuid.lower()

    user_id: Optional[int] = None
    binding = None

    # Find by UUID first
    if tourist_uuid:
        tid = db.query(TouristIDModel).filter(TouristIDModel.uuid == tourist_uuid).first()
        if tid:
            user_id = tid.user_id
            binding = db.query(RFIDBindingModel).filter(
                RFIDBindingModel.user_id == user_id,
                RFIDBindingModel.active == True
            ).order_by(RFIDBindingModel.created_at.desc()).first()

    # Fallback to tag
    if not user_id and tag:
        b = db.query(RFIDBindingModel).filter(RFIDBindingModel.tag_id == tag, RFIDBindingModel.active == True).first()
        if b:
            user_id = b.user_id
            binding = b

    if not user_id:
        return {"ok": False, "valid": False, "message": "tourist_not_found"}

    # Get full tourist details
    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    tid = db.query(TouristIDModel).filter(TouristIDModel.user_id == user_id).order_by(TouristIDModel.created_at.desc()).first()
    
    now = datetime.utcnow()
    valid = False
    if tid and tid.valid_from and tid.valid_to and tid.valid_from <= now <= tid.valid_to:
        valid = True

    # Get KYC documents if available
    kyc_doc = db.query(AadhaarModel).filter(AadhaarModel.user_id == user_id).first()
    kyc_status = "none"
    kyc_documents = []
    if kyc_doc:
        if kyc_doc.status == "approved":
            kyc_status = "approved"
        elif kyc_doc.status == "rejected":
            kyc_status = "rejected"
        else:
            kyc_status = "pending"
        
        kyc_documents = []
        if kyc_doc.front_path:
            kyc_documents.append({"type": "front", "url": f"/api/proxy{kyc_doc.front_path}"})
        if kyc_doc.back_path:
            kyc_documents.append({"type": "back", "url": f"/api/proxy{kyc_doc.back_path}"})

    result = {
        "ok": True,
        "valid": valid,
        "user_id": user_id,
        "name": u.name if u else "Unknown",
        "email": u.email if u else "unknown@example.com",
        "phone": u.phone if u else "N/A",
        "tourist_uuid": tid.uuid if tid else None,
        "kyc_status": kyc_status,
        "kyc_documents": kyc_documents,
        "valid_from": (tid.valid_from.isoformat() + "Z" if tid and tid.valid_from else None),
        "valid_to": (tid.valid_to.isoformat() + "Z" if tid and tid.valid_to else None),
        "profile_photo_url": u.profile_photo_path if u else None
    }
    
    # Store result for frontend to poll
    global rfid_last_read_result
    rfid_last_read_result = {
        "result": result,
        "timestamp": datetime.utcnow()
    }
    
    return result

@app.post("/api/admin/rfid/bind")
async def rfid_bind(body: RFIDBindBody, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    tag = (body.tag_id or "").strip().upper()
    if not tag:
        raise HTTPException(status_code=400, detail="invalid_tag")
    u = db.query(UserModel).filter(UserModel.id == body.user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="user_not_found")
    # Ensure the user has a Tourist ID (create once if missing)
    created_tid = False
    # Opportunistically purge expired to keep table clean
    try:
        _purge_expired_ids(db)
    except Exception:
        pass
    tid = db.query(TouristIDModel).filter(TouristIDModel.user_id == u.id).order_by(TouristIDModel.created_at.desc()).first()
    now = datetime.utcnow()
    # If no ID or the latest ID is expired, create a fresh one (30 days)
    if tid is None or (getattr(tid, 'valid_to', None) and tid.valid_to < now):
        # Create one-time Tourist ID (30 days default)
        new_uid = uuid.uuid4().hex
        qr_file = os.path.join("data/qr", f"{new_uid}.png")
        try:
            if qrcode:
                img = qrcode.make(new_uid)
                img.save(qr_file)
            else:
                with open(qr_file, 'wb') as f:
                    f.write(b'')
        except Exception:
            pass
        vf = datetime.utcnow()
        vt = vf + timedelta(days=30)
        tid = TouristIDModel(user_id=u.id, uuid=new_uid, qr_path=qr_file, valid_from=vf, valid_to=vt)
        db.add(tid)
        db.commit()
        created_tid = True
    # Default blockchain_id to TouristID UUID if not provided
    default_chain = body.blockchain_id or (getattr(tid, 'uuid', None) or "")
    b = db.query(RFIDBindingModel).filter(RFIDBindingModel.tag_id == tag).first()
    if b:
        b.user_id = body.user_id
        b.blockchain_id = (body.blockchain_id or b.blockchain_id or default_chain)
        b.active = True
        db.add(b)
    else:
        b = RFIDBindingModel(user_id=body.user_id, tag_id=tag, blockchain_id=(default_chain), created_at=datetime.utcnow(), active=True)
        db.add(b)
    db.commit()
    return {"ok": True, "tourist_id": getattr(tid, 'uuid', None), "tourist_created": created_tid}

@app.get("/api/admin/rfid/bind-check")
async def rfid_bind_check(user_id: int, tag_id: str, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    """Frontend calls this while waiting for write - checks if binding exists"""
    tag = (tag_id or "").strip().upper()
    b = db.query(RFIDBindingModel).filter(
        RFIDBindingModel.user_id == user_id,
        RFIDBindingModel.tag_id == tag,
        RFIDBindingModel.active == True
    ).first()
    return {"exists": b is not None}

def _tourist_brief(db: Session, user_id: int) -> dict[str, Any]:
    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    tid = db.query(TouristIDModel).filter(TouristIDModel.user_id == user_id).order_by(TouristIDModel.created_at.desc()).first()
    valid = False
    now = datetime.utcnow()
    if tid and tid.valid_from and tid.valid_to and tid.valid_from <= now <= tid.valid_to:
        valid = True
    return {
        "user_id": user_id,
        "name_masked": _mask_name(getattr(u, 'name', None)),
        "tourist_id": getattr(tid, 'uuid', None),
        "valid_from": (tid.valid_from.isoformat()+"Z" if getattr(tid, 'valid_from', None) else None),
        "valid_to": (tid.valid_to.isoformat()+"Z" if getattr(tid, 'valid_to', None) else None),
        "valid": valid,
    }

@app.post("/api/rfid/verify")
async def rfid_verify(body: RFIDVerifyBody, db: Session = Depends(get_db)):
    # Normalize incoming parameters
    tag: Optional[str] = (body.tag_id or "").strip().upper() if body.tag_id else None
    tourist_uuid_raw = (body.tourist_uuid or "").strip() if body.tourist_uuid else None
    blockchain_id = (body.blockchain_id or "").strip() if getattr(body, 'blockchain_id', None) else None

    # Accept tourist IDs that are written with a 0x prefix (strip it)
    tourist_uuid: Optional[str] = None
    if tourist_uuid_raw:
        tourist_uuid = tourist_uuid_raw[2:] if tourist_uuid_raw.lower().startswith("0x") else tourist_uuid_raw
        tourist_uuid = tourist_uuid.lower()

    if not tag and not tourist_uuid and not blockchain_id:
        raise HTTPException(status_code=400, detail="missing_parameters")

    binding = None
    user_id: Optional[int] = None

    # Priority 1: tourist_uuid -> resolve to user and binding
    if tourist_uuid and not tag:
        tid = db.query(TouristIDModel).filter(TouristIDModel.uuid == tourist_uuid).order_by(TouristIDModel.created_at.desc()).first()
        if tid:
            user_id = tid.user_id
            try:
                binding = db.query(RFIDBindingModel).filter(
                    RFIDBindingModel.user_id == user_id,
                    RFIDBindingModel.active == True
                ).order_by(RFIDBindingModel.created_at.desc()).first()  # noqa: E712
                if binding:
                    tag = binding.tag_id
            except Exception:
                binding = None

    # Priority 2: blockchain_id -> resolve binding by blockchain payload
    if not binding and blockchain_id and not tag and not user_id:
        try:
            b_by_chain = db.query(RFIDBindingModel).filter(RFIDBindingModel.blockchain_id == blockchain_id, RFIDBindingModel.active == True).order_by(RFIDBindingModel.created_at.desc()).first()  # noqa: E712
        except Exception:
            b_by_chain = None
        if b_by_chain:
            binding = b_by_chain
            tag = binding.tag_id
            user_id = binding.user_id
            # Try to find the tourist UUID for the user
            try:
                tid = db.query(TouristIDModel).filter(TouristIDModel.user_id == user_id).order_by(TouristIDModel.created_at.desc()).first()
                if tid:
                    tourist_uuid = tid.uuid
            except Exception:
                pass

    # Fallback: find binding by tag
    b = None
    if tag and not binding:
        b = db.query(RFIDBindingModel).filter(RFIDBindingModel.tag_id == tag, RFIDBindingModel.active == True).first()  # noqa: E712

    brief: dict[str, Any]
    valid = False
    if binding:
        brief = _tourist_brief(db, binding.user_id)
        valid = brief["valid"]
        user_id = binding.user_id
        tourist_uuid = brief.get("tourist_id")
    elif b:
        brief = _tourist_brief(db, b.user_id)
        valid = brief["valid"]
        user_id = b.user_id
        tourist_uuid = brief.get("tourist_id")
    elif user_id is not None:
        # We resolved a user (e.g., from tourist_uuid) but no active tag binding; still return their brief
        brief = _tourist_brief(db, user_id)
        valid = brief["valid"]
        tourist_uuid = brief.get("tourist_id")
    else:
        brief = {"user_id": None, "name_masked": "Unknown", "tourist_id": None, "valid_from": None, "valid_to": None, "valid": False}

    # Persist scan record
    try:
        rec = RFIDScanModel(tag_id=tag, valid=valid, user_id=user_id, tourist_uuid=tourist_uuid, scanned_at=datetime.utcnow())
        db.add(rec)
        db.commit()
    except Exception:
        pass

    data = {"tag_id": tag, **brief}
    dead: list[WebSocket] = []
    for ws in rfid_clients:
        try:
            await ws.send_json({"event": "rfid_scan", "data": data})
        except Exception:
            dead.append(ws)
    for ws in dead:
        try:
            rfid_clients.discard(ws)
        except Exception:
            pass
    return {"ok": True, **brief}

@app.websocket("/ws/rfid")
async def ws_rfid(ws: WebSocket):
    await ws.accept()
    rfid_clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        rfid_clients.discard(ws)
    except Exception:
        rfid_clients.discard(ws)

@app.get("/api/admin/rfid/bindings")
async def list_rfid_bindings(user_id: Optional[int] = None, tag_id: Optional[str] = None, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    q = db.query(RFIDBindingModel)
    if user_id is not None:
        q = q.filter(RFIDBindingModel.user_id == user_id)
    if tag_id:
        q = q.filter(RFIDBindingModel.tag_id == tag_id.strip().upper())
    items = q.order_by(RFIDBindingModel.created_at.desc()).limit(200).all()
    return {"items": [ {"id": x.id, "user_id": x.user_id, "tag_id": x.tag_id, "blockchain_id": x.blockchain_id, "active": x.active, "created_at": x.created_at.isoformat()+"Z"} for x in items ]}

@app.delete("/api/admin/users/{user_id}/rfid-binding")
async def delete_user_rfid_binding(user_id: int, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    items = db.query(RFIDBindingModel).filter(RFIDBindingModel.user_id == user_id).all()
    count = 0
    for x in items:
        db.delete(x)
        count += 1
    if count:
        db.commit()
    return {"deleted": count}

@app.delete("/api/admin/rfid/bindings/{binding_id}")
async def delete_rfid_binding(binding_id: int, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    b = db.query(RFIDBindingModel).filter(RFIDBindingModel.id == binding_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="not_found")
    db.delete(b)
    db.commit()
    return {"ok": True}

# ========== RFID Module Mode Control (for Admin UI & ESP) ==========

@app.post("/api/admin/rfid/mode/write-on")
async def rfid_write_mode_on(user_id: int, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    """Admin UI calls this when Write button is clicked"""
    rfid_mode_state["write_enabled"] = True
    rfid_mode_state["read_enabled"] = False
    rfid_mode_state["user_id"] = user_id
    rfid_mode_state["last_updated"] = datetime.utcnow()
    return {"ok": True, "mode": "write", "user_id": user_id}

@app.post("/api/admin/rfid/mode/read-on")
async def rfid_read_mode_on(user_id: int, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    """Admin UI calls this when Read button is clicked"""
    rfid_mode_state["read_enabled"] = True
    rfid_mode_state["write_enabled"] = False
    rfid_mode_state["user_id"] = user_id
    rfid_mode_state["last_updated"] = datetime.utcnow()
    return {"ok": True, "mode": "read", "user_id": user_id}

@app.post("/api/admin/rfid/mode/off")
async def rfid_mode_off(db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    """Admin UI calls this when popup is closed"""
    global rfid_last_read_result, rfid_last_write_result
    rfid_mode_state["write_enabled"] = False
    rfid_mode_state["read_enabled"] = False
    rfid_mode_state["user_id"] = None
    rfid_mode_state["last_updated"] = datetime.utcnow()
    rfid_last_read_result["result"] = None  # Clear old read result
    rfid_last_write_result["uuid"] = None  # Clear old write result
    return {"ok": True, "mode": "off"}

@app.get("/api/rfid/module/status")
async def rfid_module_status():
    """ESP8266/ESP32 polls this every 5 seconds to check which mode is active"""
    return {
        "write_enabled": rfid_mode_state["write_enabled"],
        "read_enabled": rfid_mode_state["read_enabled"],
        "user_id": rfid_mode_state["user_id"],
        "last_updated": rfid_mode_state["last_updated"].isoformat() + "Z"
    }

@app.get("/api/rfid/last-read")
async def rfid_last_read():
    """Frontend polls this to check if ESP detected and verified a card"""
    if rfid_last_read_result["result"]:
        return rfid_last_read_result["result"]
    return {"ok": False}  # Return proper JSON, not null

@app.post("/api/rfid/write/complete")
async def rfid_write_complete(uuid: str):
    """ESP calls this AFTER successfully writing UUID to card"""
    global rfid_last_write_result
    rfid_last_write_result = {
        "uuid": uuid.strip() if uuid else None,
        "timestamp": datetime.utcnow()
    }
    return {"ok": True}

@app.get("/api/rfid/last-write")
async def rfid_last_write():
    """Frontend polls this to check if ESP wrote a card"""
    if rfid_last_write_result["uuid"]:
        return {"uuid": rfid_last_write_result["uuid"]}
    return {"ok": False}  # Return proper JSON, not null

@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: int, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="not_found")
    # Cleanup related rows
    tids = db.query(TouristIDModel).filter(TouristIDModel.user_id == u.id).all()
    for t in tids:
        path = t.qr_path
        db.delete(t)
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
    db.query(AadhaarModel).filter(AadhaarModel.user_id == u.id).delete()
    db.query(UserLocationModel).filter(UserLocationModel.user_id == u.id).delete()
    db.query(ItineraryModel).filter(ItineraryModel.user_id == u.id).delete()
    db.query(RFIDBindingModel).filter(RFIDBindingModel.user_id == u.id).delete()
    db.delete(u)
    db.commit()
    return {"ok": True}

# Admin: delete users by exact name (case-insensitive) and cleanup related rows
class DeleteByNameBody(BaseModel):
    name: str

@app.post("/api/admin/users/delete-by-name")
async def admin_delete_users_by_name(body: DeleteByNameBody, db: Session = Depends(get_db), _: UserModel = Depends(require_admin)):
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="invalid_name")
    name = body.name.strip()
    try:
        from sqlalchemy import func
        users = db.query(UserModel).filter(func.lower(UserModel.name) == name.lower()).all()
    except Exception:
        users = db.query(UserModel).filter(UserModel.name == name).all()
    deleted_users = 0
    for u in users:
        # Delete Tourist IDs (and QR files)
        tids = db.query(TouristIDModel).filter(TouristIDModel.user_id == u.id).all()
        for t in tids:
            path = t.qr_path
            db.delete(t)
            try:
                if path and os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
        # Delete KYC records
        db.query(AadhaarModel).filter(AadhaarModel.user_id == u.id).delete()
        # Delete locations
        db.query(UserLocationModel).filter(UserLocationModel.user_id == u.id).delete()
        # Delete itineraries
        db.query(ItineraryModel).filter(ItineraryModel.user_id == u.id).delete()
        # Delete RFID bindings
        db.query(RFIDBindingModel).filter(RFIDBindingModel.user_id == u.id).delete()
        # Finally delete the user
        db.delete(u)
        deleted_users += 1
    if deleted_users:
        db.commit()
    return {"deleted": deleted_users}

