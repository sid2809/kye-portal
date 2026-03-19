# KYE Portal — Leapfour Media

Live employee verification portal with form, camera photo capture, document scanning, and 10-second video recording.

**Live URL:** https://verify.leapfour.work  
**Admin:** https://verify.leapfour.work/admin

---

## Deployment on Railway (Step-by-Step)

### 1. Push to GitHub

```bash
cd kye-portal
git init
git add .
git commit -m "KYE verification portal"
git remote add origin https://github.com/sid2809/kye-portal.git
git push -u origin main
```

### 2. Create Railway Service

1. Go to [railway.app](https://railway.app) → your project (or create new)
2. Click **"New Service"** → **"GitHub Repo"** → select `kye-portal`
3. Railway auto-detects the Dockerfile and starts building

### 3. Add Persistent Volume

This stores the SQLite database and uploaded files (photos, videos).

1. Click the service → **Settings** → **Volumes**
2. Click **"Add Volume"**
3. Mount path: `/data`
4. Size: 1 GB is plenty

### 4. Set Environment Variables

In the service → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `DATA_DIR` | `/data` |
| `ADMIN_PASSWORD` | (pick a strong password) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | your Gmail App Password (see below) |
| `NOTIFY_EMAIL` | `siddharth@leapfour.agency` (or wherever you want alerts) |

#### Getting a Gmail App Password
1. Go to https://myaccount.google.com/apppasswords
2. Sign in (2FA must be enabled on your Google account)
3. Create app password for "Mail" → "Other" → name it "KYE Portal"
4. Copy the 16-character password → use as `SMTP_PASS`

### 5. Custom Domain

1. In the service → **Settings** → **Networking** → **Custom Domain**
2. Enter: `verify.leapfour.work`
3. Railway gives you a CNAME target (something like `xxx.up.railway.app`)
4. Go to your domain registrar (wherever `leapfour.work` is registered)
5. Add DNS record:
   - Type: **CNAME**
   - Name: **verify**
   - Target: the Railway CNAME value
6. Wait a few minutes for DNS propagation
7. Railway auto-provisions SSL

### 6. Verify

- Employee form: https://verify.leapfour.work
- Admin dashboard: https://verify.leapfour.work/admin

---

## Architecture

```
Single Railway Service
├── FastAPI backend (Python)
│   ├── /api/submit — receives form + base64 files
│   ├── /api/admin/submissions — lists all (password-protected)
│   └── /api/admin/file/{id}/{name} — serves uploaded files
├── React frontend (Vite build, served as static files)
│   ├── / — Employee KYE form
│   └── /admin — Admin dashboard
└── Persistent Volume (/data)
    ├── kye.db (SQLite)
    └── uploads/{submission_id}/ (photos + video)
```

## Local Development

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
DATA_DIR=./data ADMIN_PASSWORD=test uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Frontend dev server proxies `/api` to the backend at port 8000.
