# VynixHR backend

A Flask + SQLAlchemy API for a local HR workspace. The original task API is retained. The canonical dependency list is `requirements.txt`.

## Start

Use `python start.py` from the repository root to create the environment, prepare SQLite, seed fictional records, train the local FAQ model, and start every service.

For backend-only development after installing dependencies:

```powershell
cd backend
..\.venv\Scripts\python.exe seed.py
..\.venv\Scripts\python.exe application.py
```

The API listens at `http://127.0.0.1:5000`. Debug mode and the automatic reloader are disabled. SQLite runs inside the API process and needs no separate database server. Configuration loads from `backend/.env`; `.env.example` documents the supported values. Without a database setting, SQLite uses `backend/instance/vynixhr.db`. A randomly generated process secret is used if no JWT secret exists, so configure a stable local secret to preserve sessions across restarts. The project launcher does this automatically.

## Demo accounts and data

| Account | Email | Password |
| --- | --- | --- |
| HR administrator | `admin@vynixhr.local` | `Welcome@123` |
| Employee self-service | `employee@vynixhr.local` | `Welcome@123` |

`seed.py` creates 28 fictional employees across seven departments, 14 days of attendance, 10 leave requests, six jobs, 12 applicants, four announcements, and task tags. One employee is archived, so the initial active headcount is 27. All contact details are examples. Dates are relative to the first seed run. Rerunning the seed preserves existing edits and does not duplicate records. Remove a disposable demo database manually only when you intentionally want a fresh data set.

An `hr_profiles` table links accounts to HR roles and employee records without replacing the original users table. Registration always creates an ordinary account. Matching a demo email never elevates an existing user. Administrator actions require an explicit admin profile; employee accounts see their own employee, leave, and attendance data. Announcements and company settings are readable by signed-in users. The frontend currently focuses on the administrator workspace.

## Authentication and API

`POST /api/v1/auth/sign-in` accepts `{ "email": "...", "password": "..." }` and returns `{ "token": "..." }`. Send that token in `Authorization: Bearer <token>` for protected requests. JWTs expire after four hours. User-directory reads are protected, and the retained task API scopes reads, updates, and deletion to the task owner.

All routes below are under `/api/v1`:

| Method and route | Behavior |
| --- | --- |
| `GET /health` | Public service and database health |
| `GET /hr/me`, `PATCH /hr/profile` | Current account and name/email updates |
| `GET /hr/overview` | Live headcount, department distribution, attendance and hiring metrics |
| `GET /hr/employees` | Employee list; optional `search`, `department`, `status` filters |
| `POST /hr/employees` | Create an employee |
| `GET`, `PATCH`, `DELETE /hr/employees/:id` | Read, edit, or archive an employee while keeping historical records |
| `GET`, `POST /hr/leaves` | List or request leave |
| `PATCH /hr/leaves/:id` | Administrator approval or rejection of a pending request |
| `GET /hr/attendance?date=YYYY-MM-DD` | Attendance rows and summary for a date; defaults to today |
| `POST /hr/attendance/check-in` | Record today's office/remote check-in |
| `POST /hr/attendance/check-out` | Record today's check-out |
| `GET`, `POST /hr/jobs`, `PATCH /hr/jobs/:id` | Job list, creation, editing, opening or closing |
| `POST /hr/applicants`, `PATCH /hr/applicants/:id` | Add candidates and update pipeline stages |
| `GET`, `POST /hr/announcements` | Read or publish team announcements |
| `GET`, `PATCH /hr/settings` | Company settings and administrator updates |
| `GET /ai/status`, `POST /ai/chat` | Authenticated local FAQ service proxy |

List responses use named collections: `{ "employees": [] }`, `{ "leaves": [] }`, `{ "attendance": [], "summary": {}, "date": "..." }`, `{ "jobs": [], "applicants": [] }`, and `{ "announcements": [] }`. Mutation responses wrap one resource, such as `{ "employee": {} }`; creates return 201. Validation and permission errors return a meaningful `message` and an appropriate HTTP status.

Employee creation requires `first_name`, `last_name`, `email`, `department`, `job_title`, and `join_date`. Optional fields include `phone`, `location`, `employment_type`, `status`, `manager`, and `avatar_color`. Supported employment types are `Full-time`, `Part-time`, `Contract`, and `Intern`; employee statuses are `active`, `on_leave`, and `inactive`.

Leave requests require `employee_id`, `type`, `start_date`, `end_date`, and `reason`. Types are `Annual`, `Sick`, `Casual`, `Parental`, and `Unpaid`. Duration counts inclusive calendar days. Pending and approved date ranges cannot overlap. Reviewed requests cannot be reviewed again. This demo records requests and configurable annual/sick entitlement values; it does not calculate accruals, deduct payroll, or implement statutory leave rules.

Attendance writes accept `employee_id`; check-in also accepts `work_mode` (`office` or `remote`). The server timestamps writes using UTC and calculates the workday in the configured IANA timezone. Duplicate check-ins/check-outs, checkout before check-in, archived employees, and check-in during approved leave are rejected.

Applicants move among `applied`, `screening`, `interview`, `offer`, `hired`, and `rejected`. Hiring a candidate is a pipeline update; it does not automatically provision an employee account.

The AI proxy accepts `{ "message": "How do I request leave?" }` (1–2000 characters), forwards only that question to `AI_SERVICE_URL`, and returns the grounded FAQ answer, confidence, source, and suggestions. It never sends employee records. An unavailable local model yields HTTP 503 with recovery instructions. FAQ policies are fictional demo policies maintained independently of company setting edits.

## Verification

```powershell
cd backend
..\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The integration suite uses isolated in-memory SQLite databases. It covers authentication, admin versus employee access, data validation, employee CRUD/archive, leave transitions and overlap, attendance state, applicant pipelines, settings, deleted accounts, task ownership, AI failures, and seed idempotency. CORS permits only the local Vite frontend origins (`localhost:5173` and `127.0.0.1:5173`).

Implementation references: [Flask application factories](https://flask.palletsprojects.com/en/stable/patterns/appfactories/) and [Flask-JWT-Extended authentication](https://flask-jwt-extended.readthedocs.io/en/stable/basic_usage.html).
