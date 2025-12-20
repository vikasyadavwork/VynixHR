# VynixHR

A local HR workspace for managing people, attendance, leave, recruitment, and everyday HR questions. Built with React, TypeScript, Flask, SQLite, and a locally trained FAQ retrieval model.

## Start everything

Install **Python 3.11+** and **Node.js 20.19+**, then run:

```sh
git clone https://github.com/vikasyadavwork/VynixHR.git
cd VynixHR
python start.py
```

On Windows you can also double-click **start.bat**.

The launcher creates a Python environment, installs locked dependencies, creates local settings with a random session secret, prepares SQLite, seeds fictional employees, trains the assistant, and starts all services. It opens **http://127.0.0.1:5173** when everything is ready. Press **Ctrl+C** in the launcher terminal to stop the entire app.

Internet access is needed for the first dependency installation. The app and FAQ assistant run locally afterward. SQLite is embedded in the backend, so there is no separate database installation or Docker requirement.

**Demo account:** `admin@vynixhr.local` / `Welcome@123`

This is a public demonstration account. All seeded people and company policies are fictional. Use a separate secured configuration and replace demo accounts and policies before adapting this project for an organization.

## Features

- **Dashboard:** workforce totals, attendance trends, departments, recent hires, and upcoming events from the database.
- **Employee directory:** 28 fictional sample employees, searchable profiles, department and status filters, add/edit forms, employee details, CSV export, and soft archiving.
- **Attendance:** date-based records, office/remote work modes, check-in and check-out, with company timezone handling.
- **Time off:** leave requests, date validation, pending requests, and approve/reject workflows.
- **Recruitment:** open positions and an applicant pipeline with stage updates.
- **HR assistant:** local FAQ answers with source attribution, confidence, suggested questions, and an honest fallback when no reliable policy matches.
- **Workspace:** company settings, announcements, and personal tasks with create/edit/delete and status filters.
- **Interface:** responsive layouts, accessible dialogs, search, empty/loading/error states, and reduced-motion support.
- **Access control:** signed sessions, explicit HR roles, and ownership checks for personal tasks and employee actions.

## Local AI training

The assistant is a **trained retrieval model**, not a generative large language model. It learns a searchable representation of the supplied FAQ dataset and returns a vetted answer from a matching source. This keeps it small, inspectable, repeatable, and usable without a GPU or paid API.

```sh
python ai/train.py
python ai/serve.py --host 127.0.0.1 --port 5001
```

Edit the questions, answers, and training phrases in `ai/data/faqs.json`, retrain, and restart the assistant. The generated model lives in `ai/model/` and is deliberately excluded from Git. The dataset contains 168 distinct demonstration HR questions across 14 topics; see [the AI guide](ai/README.md) for its training method, evaluation, and limitations.

Questions about an individual's salary, leave balance, or other private records cannot be answered from generic policies. The assistant refers these requests to HR. Model confidence is a similarity score, not a guarantee that an answer is correct.

## Commands

| Command | Purpose |
| --- | --- |
| `python start.py` | Set up and launch the complete app |
| `python start.py --setup-only` | Install dependencies, create/seed the database, and train AI |
| `python start.py --skip-install` | Launch using already installed dependencies |
| `python start.py --no-browser` | Launch without opening a tab |
| `python start.py --skip-install --smoke-test` | Start everything, verify the integration, then stop |
| `python scripts/check.py` | Run backend/AI tests, frontend lint/format checks, and the production build |
| `python ai/train.py` | Retrain the local FAQ model |

Dependency installation is skipped when the recorded requirements and lockfile have not changed. Seeding is repeatable and does not reset edited employee records. If a required port is occupied, the launcher reports it instead of terminating another process.

## Project structure

```text
VynixHR/
  frontend/          React + TypeScript workspace
  backend/           Flask routes, models, validation, seed data, and tests
  ai/                FAQ dataset, local training, inference server, and tests
  scripts/check.py   Shared local/CI verification command
  start.py           Cross-platform setup and process supervisor
  start.bat          Windows double-click entry point
  docs/              Architecture and project-history notes
```

| Service | Address |
| --- | --- |
| Frontend | http://127.0.0.1:5173 |
| Backend API | http://127.0.0.1:5000/api/v1 |
| Original task API documentation | http://127.0.0.1:5000/docs |
| Local AI health | http://127.0.0.1:5001/health |

The Vite development server proxies `/api` requests to Flask. Flask authorizes chat requests and calls the local AI service with a timeout. Runtime logs are in `.runtime/`; the default database is `backend/instance/vynixhr.db`. Both locations are excluded from Git.

The launcher creates `backend/.env` if it does not exist and preserves an existing configuration. Available configuration keys are listed in `backend/.env.example`. Do not commit secrets or local databases.

## Troubleshooting

- **A port is occupied:** stop the earlier VynixHR launcher or the application using port 5173, 5000, or 5001, then retry.
- **A service fails:** inspect `.runtime/frontend.log`, `.runtime/backend.log`, or `.runtime/ai.log`.
- **Python or npm is missing:** install the prerequisite, reopen your terminal, and retry.
- **The assistant is offline:** restart `python start.py`; the launcher retrains the model before starting it.
- **Custom database settings fail:** inspect your own `backend/.env`. A new checkout uses SQLite automatically.

## Development and attribution

This project extends the EmPulseHR Flask/React starter from **AetherXTech/EmPulseHR**. The starter README credits **Santiago de Jesus Moraga Caldera (Remy349)**; that attribution is retained here. The HR workspace, local FAQ assistant, launch tooling, and verification were added for VynixHR.

The July–December 2025 Git milestones are a **reconstructed development timeline**, created in September 2026 at the project owner's request. They describe implementation stages and do not claim contemporaneous work. See [project history](docs/PROJECT_HISTORY.md).
