"""Small validation, authorization, and serialization helpers for HR routes."""

import re
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import abort, g, has_request_context, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy.exc import IntegrityError

from flaskr.db import db
from flaskr.models import CompanySetting, Employee, HRProfile, UserModel

EMPLOYMENT_TYPES = ("Full-time", "Part-time", "Contract", "Intern")
EMPLOYEE_STATUSES = ("active", "on_leave", "inactive")
LEAVE_TYPES = ("Annual", "Sick", "Casual", "Parental", "Unpaid")
APPLICANT_STAGES = ("applied", "screening", "interview", "offer", "hired", "rejected")
SETTINGS_DEFAULTS = {
    "company_name": "Vynix Technologies",
    "company_email": "people@vynixhr.local",
    "location": "Bengaluru, India",
    "work_start": "09:00",
    "work_end": "18:00",
    "annual_leave_days": 18,
    "sick_leave_days": 12,
    "timezone": "Asia/Kolkata",
}


def payload(allowed):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Send a JSON object in the request body.")
    unknown = set(data) - set(allowed)
    if unknown:
        abort(400, description=f"Unknown fields: {', '.join(sorted(unknown))}.")
    return data


def string(data, key, *, required=False, maximum=120, default=""):
    value = data.get(key, default)
    if not isinstance(value, str):
        abort(400, description=f"{key} must be text.")
    value = value.strip()
    if required and not value:
        abort(400, description=f"{key} is required.")
    if len(value) > maximum:
        abort(400, description=f"{key} cannot exceed {maximum} characters.")
    return value


def choice(data, key, choices, default=None):
    value = data.get(key, default)
    if value not in choices:
        abort(400, description=f"{key} must be one of: {', '.join(choices)}.")
    return value


def email(data, key="email"):
    value = string(data, key, required=True).lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        abort(400, description=f"{key} must be a valid email address.")
    return value


def parse_date(value, key):
    try:
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        abort(400, description=f"{key} must be a valid date in YYYY-MM-DD format.")


def integer(value, key, minimum=1, maximum=1_000_000):
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or not minimum <= value <= maximum
    ):
        abort(
            400,
            description=f"{key} must be an integer between {minimum} and {maximum}.",
        )
    return value


def current_user():
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        abort(401, description="Invalid account. Please sign in again.")
    if "hr_user" not in g or g.hr_user is None or g.hr_user.id != user_id:
        g.hr_user = db.session.get(UserModel, user_id)
        if g.hr_user is None:
            abort(
                401, description="This account no longer exists. Please sign in again."
            )
        g.hr_profile = db.session.execute(
            db.select(HRProfile).where(HRProfile.user_id == user_id)
        ).scalar_one_or_none()
    return g.hr_user


def current_profile():
    current_user()
    return g.hr_profile


def is_admin():
    profile = current_profile()
    return profile is not None and profile.role == "admin"


def require_admin():
    if not is_admin():
        abort(
            403, description="An HR administrator account is required for this action."
        )


def require_employee_access(employee_id):
    profile = current_profile()
    if not is_admin() and (profile is None or profile.employee_id != employee_id):
        abort(403, description="You can only access your own employee records.")


def get_employee(employee_id):
    employee = db.session.get(Employee, employee_id)
    if employee is None:
        abort(404, description="Employee not found.")
    return employee


def commit(message="A record with these details already exists."):
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409, description=message)


def settings_dict():
    settings = dict(SETTINGS_DEFAULTS)
    for record in db.session.execute(db.select(CompanySetting)).scalars():
        if record.key in settings:
            value = record.value
            if isinstance(SETTINGS_DEFAULTS[record.key], int):
                value = int(value)
            settings[record.key] = value
    return settings


def company_zone():
    if has_request_context() and "company_timezone" in g:
        return g.company_timezone
    try:
        zone = ZoneInfo(settings_dict()["timezone"])
    except ZoneInfoNotFoundError:
        zone = timezone.utc
    if has_request_context():
        g.company_timezone = zone
    return zone


def company_now():
    return datetime.now(company_zone())


def timestamp(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def employee_dict(employee):
    return {
        "id": employee.id,
        "employee_code": employee.employee_code,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "name": employee.name,
        "email": employee.email,
        "phone": employee.phone,
        "department": employee.department,
        "job_title": employee.job_title,
        "employment_type": employee.employment_type,
        "status": employee.status,
        "location": employee.location,
        "join_date": employee.join_date.isoformat(),
        "manager": employee.manager,
        "avatar_color": employee.avatar_color,
    }


def leave_dict(leave):
    return {
        "id": leave.id,
        "employee_id": leave.employee_id,
        "employee_name": leave.employee.name,
        "department": leave.employee.department,
        "avatar_color": leave.employee.avatar_color,
        "type": leave.type,
        "start_date": leave.start_date.isoformat(),
        "end_date": leave.end_date.isoformat(),
        "days": leave.days,
        "reason": leave.reason,
        "status": leave.status,
        "created_at": timestamp(leave.created_at),
        "reviewed_at": timestamp(leave.reviewed_at),
    }


def attendance_dict(employee, day, record=None, on_leave=False):
    def local_time(value):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(company_zone()).strftime("%H:%M")

    hours = 0
    if record and record.check_out:
        # SQLite strips timezone information from both values, keeping their UTC clock time.
        hours = round((record.check_out - record.check_in).total_seconds() / 3600, 2)
    status = "on_leave" if on_leave else "absent"
    if record:
        status = "remote" if record.work_mode == "remote" else "present"
    return {
        "id": record.id if record else None,
        "employee_id": employee.id,
        "employee_name": employee.name,
        "department": employee.department,
        "avatar_color": employee.avatar_color,
        "date": day.isoformat(),
        "check_in": local_time(record.check_in) if record else None,
        "check_out": local_time(record.check_out) if record else None,
        "work_mode": record.work_mode if record else "office",
        "status": status,
        "hours": hours,
    }


def job_dict(job):
    return {
        "id": job.id,
        "title": job.title,
        "department": job.department,
        "location": job.location,
        "employment_type": job.employment_type,
        "description": job.description,
        "status": job.status,
        "created_at": timestamp(job.created_at),
        "applicants_count": len(job.applicants),
    }


def applicant_dict(applicant):
    return {
        "id": applicant.id,
        "job_id": applicant.job_id,
        "job_title": applicant.job.title,
        "name": applicant.name,
        "email": applicant.email,
        "experience_years": applicant.experience_years,
        "stage": applicant.stage,
        "avatar_color": applicant.avatar_color,
        "applied_at": timestamp(applicant.applied_at),
    }


def announcement_dict(item):
    return {
        "id": item.id,
        "title": item.title,
        "body": item.body,
        "category": item.category,
        "author": item.author,
        "pinned": item.pinned,
        "published_at": timestamp(item.published_at),
    }
