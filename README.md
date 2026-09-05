# Smart Attendance System — Backend

Node.js + Express + MongoDB (Mongoose) backend for a QR + geofencing based
classroom attendance system.

## Features

- **JWT auth**, role-based (`admin`, `teacher`, `student`) — no public
  registration; every account is created by an admin.
- **QR-based attendance** with a 10-minute session window and a **rotating
  sub-token** (regenerated ~every 40s) so a screenshotted QR goes stale fast.
- **Geofencing**: attendance is only accepted within 50m (configurable) of
  the classroom, using the Haversine formula.
- **Anti-proxy measures**:
  - GPS accuracy check — rejects unreliable/low-confidence location fixes.
  - Rotating QR tokens — discourages sharing a screenshot in a group chat.
  - Per-IP rate limiting on the scan endpoint.
  - IP + device (User-Agent) logged on every attendance record for audit.
  - Unique DB index on `(session, student)` — hard stop on double-marking.
- **Leave / regularization requests** — students flag "I was present but my
  scan failed"; teachers approve/reject.
- **Dashboard analytics** endpoint — attendance %, trend over sessions,
  per-student breakdown, defaulter list (<75%) — feeds recharts on the
  frontend.
- **CSV & PDF export** of class attendance reports.
- **Low-attendance email alerts** — daily cron job (node-cron + nodemailer).
- **Audit log** — every admin action (create/update/deactivate) is recorded.
- **Soft delete** — users and classes are deactivated (`isActive: false`),
  never hard-deleted, so historical attendance stays intact.
- **Timetable view** — students see today's classes and whether a live QR
  session is currently open for each.

## Getting started

```bash
cd backend
cp .env.example .env      # then edit values (Mongo URI, JWT secret, SMTP, etc.)
npm install
npm run seed:admin        # creates the first admin account from .env
npm run dev                # starts with nodemon on http://localhost:5000
```

There is no `/register` endpoint by design. Log in as the seeded admin,
then use `/api/admin/users` to create teacher and student accounts.

## Environment variables

See `.env.example` for the full list — Mongo connection, JWT secrets, QR
token TTL, geofence radius (`MAX_ALLOWED_DISTANCE_METERS`), GPS accuracy
threshold, low-attendance %, SMTP credentials, and cron schedule.

## API overview

| Area | Base path | Notes |
|---|---|---|
| Auth | `/api/auth` | `POST /login`, `GET /me`, `PUT /change-password` |
| Admin | `/api/admin` | manage users, classes, teacher assignment, audit logs |
| Teacher | `/api/teacher` | own classes, add/remove students, attendance views, defaulters |
| Student | `/api/student` | own classes, timetable, attendance history |
| Attendance | `/api/attendance` | `POST /sessions` (start QR), `GET /sessions/:id/qr` (rotate), `POST /scan` (student) |
| Leave | `/api/leave` | submit / review regularization requests |
| Reports | `/api/reports` | `/class/:id/csv`, `/class/:id/pdf`, `/class/:id/summary` |

### Core attendance flow

1. **Teacher**: `POST /api/attendance/sessions { classId }` → returns a QR
   image (base64) valid ~40s, inside a 10-minute session window.
2. Frontend re-fetches `GET /api/attendance/sessions/:id/qr` every ~30s to
   keep showing a fresh QR on the classroom projector/screen.
3. **Student**: scans QR → app captures `navigator.geolocation` → calls
   `POST /api/attendance/scan { token, lat, lng, accuracy }`.
4. Backend verifies the token, checks the student is enrolled, checks GPS
   accuracy, computes distance via Haversine, and — if within 50m — creates
   an `AttendanceRecord`.

## Folder structure

```
backend/
 ├─ config/db.js
 ├─ models/            User, Class, AttendanceSession, AttendanceRecord,
 │                     LeaveRequest, AuditLog
 ├─ middleware/         auth.js, role.js, rateLimiter.js, errorHandler.js
 ├─ utils/              haversine.js, generateQR.js, sendEmail.js,
 │                     exportUtils.js, auditLogger.js, asyncHandler.js
 ├─ controllers/        auth, admin, teacher, student, attendance, leave, report
 ├─ routes/             one file per controller area
 ├─ jobs/               lowAttendanceCron.js
 ├─ seed/               seedAdmin.js
 └─ server.js
```

## Next steps (frontend)

- Use `axios` with a request interceptor attaching the JWT.
- A QR scanner page (`html5-qrcode` or `react-qr-reader`) that reads the
  `/attend/:token` URL, grabs `navigator.geolocation.getCurrentPosition`,
  and posts to `/api/attendance/scan`.
- `recharts` for the dashboard summary endpoint (`/api/reports/class/:id/summary`).
