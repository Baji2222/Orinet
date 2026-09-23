# HR Portal

A minimal in-house HR portal: employees log in to mark attendance, apply for
leave, download payslips, and raise requests to HR. HR (admin) gets one
dashboard to manage employees, review attendance, approve/reject leave,
upload payslips, and reply to requests.

All data (users, attendance, leave requests, HR requests, holidays) is
stored in **Supabase Postgres**, and payslip files are stored in **Supabase
Storage**. You need a free Supabase project before running this — see
setup below.

## What's included

- **Attendance** — employee check-in/check-out, personal history, admin
  overview with filters by employee/date.
- **Leave management** — apply for leave, HR approves/rejects with a
  comment, employee sees status update. Both sides get an email notification
  (or a console log if email isn't configured — see below).
- **Payslips** — HR uploads the payslip file it receives (PDF/PNG/JPG),
  employee downloads it any time. No portal on the payslip-sender's side
  needed; this becomes your own archive.
- **HR requests** — employee submits a request (e.g. "need Form 16"), HR
  replies and marks it resolved. Notifies by email both ways.
- **Admin panel** — create/remove employee accounts, set roles.

## Project structure

```
hr-portal/
  backend/     Node.js + Express API, Supabase (Postgres + Storage)
  frontend/    React + Vite single-page app
```

## Requirements

- Node.js 18+ and npm
- A free [Supabase](https://supabase.com) project

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor > New query**, paste the contents of
   `backend/supabase-schema.sql`, and run it. This creates all six tables
   the app needs (`users`, `attendance`, `leave_requests`, `payslips`,
   `requests`, `holidays`).
3. Create a Storage bucket named `payslips` (**Storage > New bucket**,
   keep it **private/non-public**) — this is where uploaded payslip files
   are stored. The SQL file has a commented-out `insert` you can run
   instead if you'd rather do it via SQL.
4. Open **Settings > API Keys** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **Secret key** (`sb_secret_...`, under the "API Keys" tab — not the
     legacy `service_role` key) → `SUPABASE_SECRET_KEY`

## 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env` and fill in `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
from the step above, then:

```bash
npm start
```

The API runs on **http://localhost:4000**.

On first run (once the `users` table is empty) it seeds a default HR admin
account directly into Supabase:

```
email:    admin@company.com
password: admin123
```

**Log in and change this immediately** (Admin → Employees → edit, or just
create your real admin account and delete this one).

### Email notifications (optional)

By default, `.env` has no SMTP settings, so the app just logs
`[mailer] SMTP not configured - skipped email to ...` to the console instead
of sending anything — everything else works normally. To actually send
emails (e.g. leave request notifications to HR, payslip-ready notices to
employees), fill in `backend/.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

For Gmail, use an **App Password**, not your normal password (Google
Account → Security → App Passwords). Any standard SMTP provider works the
same way.

## 3. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. It talks to the backend at
`http://localhost:4000/api` by default — if you run the backend on a
different port, copy `frontend/.env.example` to `.env` and update
`VITE_API_URL`.

## 4. Using it

- Log in as `admin@company.com` / `admin123`.
- Go to **Employees** and add your real employees (name, email, a temporary
  password, employee code). Each one gets an email with their login details
  (or check the backend console if SMTP isn't set up).
- Employees log in at the same URL — they land on their own dashboard
  automatically based on their role.
- As HR, upload each employee's payslip under **Payslips** once you receive
  it in your email — from then on, it's in their own portal permanently.

## Data storage

Everything lives in Supabase: all records are in Postgres tables (see
`backend/supabase-schema.sql`), and payslip files are in the `payslips`
Storage bucket. Back up your Supabase project regularly (Supabase does
daily backups on paid plans; on the free plan, export via the SQL editor
or `pg_dump` yourself).

## Deploying

This is meant to be deployed as **two separate Vercel projects**, not one:

- **Backend** — import the repo into Vercel with **Root Directory** set to
  `backend`. It picks up `backend/vercel.json` and `backend/api/index.js`
  automatically. Add `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`
  and (optionally) the `SMTP_*` vars as Environment Variables in the
  Vercel project settings — `.env` files aren't used in production.
- **Frontend** — import the same repo as a second Vercel project with
  **Root Directory** set to `frontend`. It picks up `frontend/vercel.json`.
  Add `VITE_API_URL` as an Environment Variable, pointing at your deployed
  backend's URL (e.g. `https://your-backend.vercel.app/api`).
- If you use different production domains than the defaults, update the
  `allowedOrigins` list in `backend/server.js` to match (any `*.vercel.app`
  origin is already allowed automatically).

## Security notes before real use

- Change `JWT_SECRET` in `backend/.env` (or your Vercel project's
  environment variables) to a long random string.
- Change the default admin password immediately.
- Never expose `SUPABASE_SECRET_KEY` to the frontend or commit it to
  source control — it has full access to your database and bypasses Row
  Level Security. Only the backend should ever hold it.
- This is built for a small internal team. For internet-facing deployment,
  make sure it's served over HTTPS (Vercel does this by default).
