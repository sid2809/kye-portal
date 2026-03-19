import os
import uuid
import sqlite3
import smtplib
import base64
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))
UPLOADS_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "kye.db"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "leapfour2026")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
NOTIFY_EMAIL = os.getenv("NOTIFY_EMAIL", "")

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                dob TEXT,
                father_name TEXT,
                gender TEXT,
                nationality TEXT,
                phone TEXT NOT NULL,
                email TEXT,
                current_address TEXT,
                pin_code TEXT,
                permanent_address TEXT,
                aadhaar_number TEXT,
                pan_number TEXT,
                emergency_name TEXT,
                emergency_relation TEXT,
                emergency_phone TEXT,
                bank_name TEXT,
                account_number TEXT,
                ifsc TEXT,
                face_photo_path TEXT,
                aadhaar_front_path TEXT,
                aadhaar_back_path TEXT,
                pan_path TEXT,
                additional_id_path TEXT,
                video_path TEXT,
                submitted_at TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                latitude REAL,
                longitude REAL,
                location_accuracy REAL,
                location_timestamp TEXT
            )
        """)
        # Migrate: add location columns if missing (for existing DBs)
        existing = {row[1] for row in db.execute("PRAGMA table_info(submissions)").fetchall()}
        for col, ctype in [("latitude", "REAL"), ("longitude", "REAL"), ("location_accuracy", "REAL"), ("location_timestamp", "TEXT")]:
            if col not in existing:
                db.execute(f"ALTER TABLE submissions ADD COLUMN {col} {ctype}")
        db.commit()


@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class FormData(BaseModel):
    fullName: str
    dob: str
    fatherName: Optional[str] = ""
    gender: Optional[str] = ""
    nationality: Optional[str] = "Indian"
    phone: str
    email: Optional[str] = ""
    currentAddress: str
    pinCode: str
    permanentAddress: Optional[str] = ""
    aadhaarNumber: str
    panNumber: str
    emergencyName: Optional[str] = ""
    emergencyRelation: Optional[str] = ""
    emergencyPhone: Optional[str] = ""
    bankName: Optional[str] = ""
    accountNumber: Optional[str] = ""
    ifsc: Optional[str] = ""


class LocationData(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
    timestamp: Optional[str] = None


class SubmissionPayload(BaseModel):
    form: FormData
    facePhoto: str          # base64 data URL
    aadhaarFront: str       # base64 data URL
    aadhaarBack: str        # base64 data URL
    pan: str                # base64 data URL
    additionalId: Optional[str] = None  # base64 data URL or null
    video: str              # base64 data URL (webm or mp4)
    videoExt: Optional[str] = "webm"    # "webm" or "mp4" (Safari)
    location: Optional[LocationData] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def save_base64_file(data_url: str, subdir: str, filename: str) -> str:
    """Save a base64 data URL to disk and return the relative path."""
    if not data_url:
        return ""
    # Handle data:image/jpeg;base64,... and data:video/webm;base64,...
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    
    file_bytes = base64.b64decode(data_url)
    save_dir = UPLOADS_DIR / subdir
    save_dir.mkdir(parents=True, exist_ok=True)
    
    filepath = save_dir / filename
    filepath.write_bytes(file_bytes)
    return str(filepath.relative_to(DATA_DIR))


def send_notification(name: str, email: str, phone: str, submission_id: str):
    """Send email notification about new KYE submission."""
    if not all([SMTP_USER, SMTP_PASS, NOTIFY_EMAIL]):
        print("Email not configured, skipping notification.")
        return
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"New KYE Submission — {name}"
        msg["From"] = SMTP_USER
        msg["To"] = NOTIFY_EMAIL

        text = f"""New KYE Verification Submitted

Name: {name}
Phone: {phone}
Email: {email or 'N/A'}
Submission ID: {submission_id}
Time: {datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p UTC')}

Review at: https://verify.leapfour.work/admin
"""
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <div style="background:#0f3d5c;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;">
    <h2 style="margin:0;font-size:18px;">🛡️ New KYE Submission</h2>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 12px 12px;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#64748b;width:120px;">Name</td><td style="padding:8px 0;font-weight:600;">{name}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Phone</td><td style="padding:8px 0;">{phone}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;">{email or 'N/A'}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">ID</td><td style="padding:8px 0;font-family:monospace;font-size:12px;">{submission_id}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Time</td><td style="padding:8px 0;">{datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p UTC')}</td></tr>
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="https://verify.leapfour.work/admin" style="background:#0f3d5c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Review Submission →
      </a>
    </div>
  </div>
</div>
"""
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, NOTIFY_EMAIL, msg.as_string())
        
        print(f"Notification sent for {name}")
    except Exception as e:
        print(f"Email send failed: {e}")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Leapfour KYE Portal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------
@app.post("/api/submit")
async def submit_verification(payload: SubmissionPayload, request: Request):
    submission_id = uuid.uuid4().hex[:12]
    ts = datetime.now(timezone.utc).isoformat()
    subdir = f"{submission_id}"
    f = payload.form

    try:
        face_path = save_base64_file(payload.facePhoto, subdir, "face.jpg")
        aadhaar_front_path = save_base64_file(payload.aadhaarFront, subdir, "aadhaar_front.jpg")
        aadhaar_back_path = save_base64_file(payload.aadhaarBack, subdir, "aadhaar_back.jpg")
        pan_path = save_base64_file(payload.pan, subdir, "pan.jpg")
        additional_path = save_base64_file(payload.additionalId or "", subdir, "additional_id.jpg") if payload.additionalId else ""
        vid_ext = payload.videoExt if payload.videoExt in ("webm", "mp4") else "webm"
        video_path = save_base64_file(payload.video, subdir, f"verification.{vid_ext}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File processing error: {str(e)}")

    loc = payload.location

    with get_db() as db:
        db.execute("""
            INSERT INTO submissions (
                id, full_name, dob, father_name, gender, nationality,
                phone, email, current_address, pin_code, permanent_address,
                aadhaar_number, pan_number,
                emergency_name, emergency_relation, emergency_phone,
                bank_name, account_number, ifsc,
                face_photo_path, aadhaar_front_path, aadhaar_back_path,
                pan_path, additional_id_path, video_path,
                submitted_at, ip_address, user_agent,
                latitude, longitude, location_accuracy, location_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            submission_id, f.fullName, f.dob, f.fatherName, f.gender, f.nationality,
            f.phone, f.email, f.currentAddress, f.pinCode, f.permanentAddress,
            f.aadhaarNumber, f.panNumber,
            f.emergencyName, f.emergencyRelation, f.emergencyPhone,
            f.bankName, f.accountNumber, f.ifsc,
            face_path, aadhaar_front_path, aadhaar_back_path,
            pan_path, additional_path, video_path,
            ts, request.client.host, request.headers.get("user-agent", ""),
            loc.lat if loc else None, loc.lng if loc else None,
            loc.accuracy if loc else None, loc.timestamp if loc else None,
        ))
        db.commit()

    # Fire-and-forget email
    try:
        send_notification(f.fullName, f.email, f.phone, submission_id)
    except Exception:
        pass

    return {"status": "ok", "id": submission_id}


@app.get("/api/admin/submissions")
async def list_submissions(password: str = ""):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM submissions ORDER BY submitted_at DESC"
        ).fetchall()
    
    return [dict(r) for r in rows]


@app.get("/api/admin/file/{submission_id}/{filename}")
async def get_file(submission_id: str, filename: str, password: str = ""):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    filepath = UPLOADS_DIR / submission_id / filename
    if not filepath.exists() or not filepath.is_relative_to(UPLOADS_DIR):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(filepath)


# ---------------------------------------------------------------------------
# Serve frontend (static files built by Vite)
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")
    
    @app.get("/admin")
    @app.get("/admin/{path:path}")
    async def serve_admin(path: str = ""):
        return FileResponse(str(STATIC_DIR / "index.html"))
    
    @app.get("/{path:path}")
    async def serve_frontend(path: str = ""):
        file_path = STATIC_DIR / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
