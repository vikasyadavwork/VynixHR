"""Authenticated HR workflows with explicit administrator and employee permissions."""

import re
import uuid
from calendar import monthrange
from collections import Counter
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, abort, g, request
from flask_jwt_extended import verify_jwt_in_request
from sqlalchemy import func, or_

from flaskr.db import db
from flaskr.hr_helpers import (
    APPLICANT_STAGES,
    EMPLOYEE_STATUSES,
    EMPLOYMENT_TYPES,
    LEAVE_TYPES,
    SETTINGS_DEFAULTS,
    announcement_dict,
    applicant_dict,
    attendance_dict,
    choice,
    commit,
    company_now,
    current_profile,
    current_user,
    email,
    employee_dict,
    get_employee,
    integer,
    is_admin,
    job_dict,
    leave_dict,
    parse_date,
    payload,
    require_admin,
    require_employee_access,
    settings_dict,
    string,
)
from flaskr.models import (
    Announcement,
    Applicant,
    Attendance,
    CompanySetting,
    Employee,
    HRProfile,
    Job,
    LeaveRequest,
)

bp = Blueprint("hr", __name__)
EMPLOYEE_FIELDS = {
    "first_name",
    "last_name",
    "email",
    "phone",
    "department",
    "job_title",
    "employment_type",
    "status",
    "location",
    "join_date",
    "manager",
    "avatar_color",
}
JOB_FIELDS = {
    "title",
    "department",
    "location",
    "employment_type",
    "description",
    "status",
}


@bp.before_request
def authenticate():
    if request.method != "OPTIONS":
        verify_jwt_in_request()
        # Also reset in long-lived application contexts used by command-line tests.
        g.pop("hr_user", None)
        g.pop("hr_profile", None)
        g.pop("company_timezone", None)
        current_user()


@bp.get("/me")
def me():
    user = current_user()
    profile = current_profile()
    return {
        "user": {
            "id": user.id,
            "name": (
                profile.display_name
                if profile and profile.display_name
                else user.username
            ),
            "email": user.email,
            "role": profile.role if profile else "employee",
            "employee_id": profile.employee_id if profile else None,
        },
        "employee": (
            employee_dict(profile.employee) if profile and profile.employee else None
        ),
    }


@bp.patch("/profile")
def update_profile():
    data = payload({"name", "email"})
    user = current_user()
    profile = current_profile()
    if profile is None:
        profile = HRProfile(
            user_id=user.id, display_name=user.username, role="employee"
        )
        db.session.add(profile)
    if "name" in data:
        profile.display_name = string(data, "name", required=True, maximum=100)
    if "email" in data:
        user.email = email(data)
    commit("An account already uses that email address.")
    return me()


def employee_values(data, partial=False):
    values = {}
    limits = {
        "first_name": 60,
        "last_name": 60,
        "phone": 30,
        "department": 80,
        "job_title": 120,
        "location": 100,
        "manager": 120,
    }
    required = {"first_name", "last_name", "department", "job_title"}
    for field, maximum in limits.items():
        if field in data or (not partial and field in required):
            values[field] = string(
                data, field, required=field in required, maximum=maximum
            )
    if "email" in data or not partial:
        values["email"] = email(data)
    if "join_date" in data or not partial:
        values["join_date"] = parse_date(data.get("join_date"), "join_date")
    if "employment_type" in data:
        values["employment_type"] = choice(data, "employment_type", EMPLOYMENT_TYPES)
    if "status" in data:
        values["status"] = choice(data, "status", EMPLOYEE_STATUSES)
    if "avatar_color" in data:
        color = string(data, "avatar_color", maximum=7)
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            abort(400, description="avatar_color must be a six-digit hex color.")
        values["avatar_color"] = color
    return values


@bp.get("/employees")
def employees():
    query = db.select(Employee)
    if not is_admin():
        profile = current_profile()
        query = query.where(Employee.id == (profile.employee_id if profile else -1))
    search = request.args.get("search", "").strip()[:120]
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Employee.first_name.ilike(pattern),
                Employee.last_name.ilike(pattern),
                (Employee.first_name + " " + Employee.last_name).ilike(pattern),
                Employee.email.ilike(pattern),
                Employee.job_title.ilike(pattern),
                Employee.employee_code.ilike(pattern),
            )
        )
    for field in ("department", "status"):
        value = request.args.get(field)
        if value and value != "all":
            query = query.where(getattr(Employee, field) == value)
    rows = (
        db.session.execute(query.order_by(Employee.first_name, Employee.last_name))
        .scalars()
        .all()
    )
    departments = sorted({item.department for item in rows})
    if is_admin():
        departments = list(
            db.session.execute(
                db.select(Employee.department).distinct().order_by(Employee.department)
            ).scalars()
        )
    return {
        "employees": [employee_dict(item) for item in rows],
        "departments": departments,
        "total": len(rows),
    }


@bp.get("/employees/<int:employee_id>")
def employee_details(employee_id):
    require_employee_access(employee_id)
    return {"employee": employee_dict(get_employee(employee_id))}


@bp.post("/employees")
def create_employee():
    require_admin()
    data = payload(EMPLOYEE_FIELDS)
    employee = Employee(
        employee_code=f"VNX-{uuid.uuid4().hex[:8].upper()}",
        **employee_values(data),
    )
    db.session.add(employee)
    commit("An employee already uses that email address.")
    return {"employee": employee_dict(employee)}, 201


@bp.patch("/employees/<int:employee_id>")
def update_employee(employee_id):
    require_admin()
    employee = get_employee(employee_id)
    for key, value in employee_values(payload(EMPLOYEE_FIELDS), partial=True).items():
        setattr(employee, key, value)
    commit("An employee already uses that email address.")
    return {"employee": employee_dict(employee)}


@bp.delete("/employees/<int:employee_id>")
def archive_employee(employee_id):
    require_admin()
    employee = get_employee(employee_id)
    employee.status = "inactive"
    commit()
    return {
        "employee": employee_dict(employee),
        "message": "Employee archived. Historical records are retained.",
    }


@bp.get("/leaves")
def leaves():
    query = db.select(LeaveRequest)
    if not is_admin():
        profile = current_profile()
        query = query.where(
            LeaveRequest.employee_id == (profile.employee_id if profile else -1)
        )
    status = request.args.get("status")
    if status and status != "all":
        query = query.where(LeaveRequest.status == status)
    rows = db.session.execute(query.order_by(LeaveRequest.created_at.desc())).scalars()
    return {"leaves": [leave_dict(item) for item in rows]}


@bp.post("/leaves")
def create_leave():
    data = payload({"employee_id", "type", "start_date", "end_date", "reason"})
    employee_id = integer(data.get("employee_id"), "employee_id")
    require_employee_access(employee_id)
    employee = get_employee(employee_id)
    if employee.status == "inactive":
        abort(409, description="Archived employees cannot request leave.")
    start = parse_date(data.get("start_date"), "start_date")
    end = parse_date(data.get("end_date"), "end_date")
    if end < start:
        abort(400, description="end_date must be on or after start_date.")
    days = (end - start).days + 1
    if days > 365:
        abort(400, description="A leave request cannot exceed 365 calendar days.")
    overlap = (
        db.session.execute(
            db.select(LeaveRequest).where(
                LeaveRequest.employee_id == employee_id,
                LeaveRequest.status.in_(("pending", "approved")),
                LeaveRequest.start_date <= end,
                LeaveRequest.end_date >= start,
            )
        )
        .scalars()
        .first()
    )
    if overlap:
        abort(
            409,
            description="These dates overlap an existing pending or approved leave request.",
        )
    leave = LeaveRequest(
        employee_id=employee_id,
        type=choice(data, "type", LEAVE_TYPES),
        start_date=start,
        end_date=end,
        days=days,
        reason=string(data, "reason", required=True, maximum=1000),
    )
    db.session.add(leave)
    commit()
    return {"leave": leave_dict(leave)}, 201


@bp.patch("/leaves/<int:leave_id>")
def review_leave(leave_id):
    require_admin()
    leave = db.session.get(LeaveRequest, leave_id)
    if leave is None:
        abort(404, description="Leave request not found.")
    if leave.status != "pending":
        abort(409, description="This leave request has already been reviewed.")
    data = payload({"status"})
    leave.status = choice(data, "status", ("approved", "rejected"))
    leave.reviewed_at = datetime.now(timezone.utc)
    leave.reviewed_by = current_user().id
    commit()
    return {"leave": leave_dict(leave)}


def attendance_for_day(day, only_employee_id=None):
    employee_query = (
        db.select(Employee)
        .where(Employee.status != "inactive", Employee.join_date <= day)
        .order_by(Employee.first_name)
    )
    if only_employee_id is not None:
        employee_query = employee_query.where(Employee.id == only_employee_id)
    staff = db.session.execute(employee_query).scalars().all()
    records = {
        item.employee_id: item
        for item in db.session.execute(
            db.select(Attendance).where(Attendance.date == day)
        ).scalars()
    }
    leave_ids = set(
        db.session.execute(
            db.select(LeaveRequest.employee_id).where(
                LeaveRequest.status == "approved",
                LeaveRequest.start_date <= day,
                LeaveRequest.end_date >= day,
            )
        ).scalars()
    )
    rows = [
        attendance_dict(item, day, records.get(item.id), item.id in leave_ids)
        for item in staff
    ]
    summary = {
        key: sum(row["status"] == key for row in rows)
        for key in ("present", "remote", "absent", "on_leave")
    }
    summary["total"] = len(rows)
    return rows, summary


@bp.get("/attendance")
def attendance():
    day = (
        parse_date(request.args["date"], "date")
        if "date" in request.args
        else company_now().date()
    )
    employee_id = None
    if not is_admin():
        profile = current_profile()
        employee_id = profile.employee_id if profile and profile.employee_id else -1
    rows, summary = attendance_for_day(day, employee_id)
    return {"attendance": rows, "summary": summary, "date": day.isoformat()}


@bp.post("/attendance/check-in")
def check_in():
    data = payload({"employee_id", "work_mode"})
    employee_id = integer(data.get("employee_id"), "employee_id")
    require_employee_access(employee_id)
    employee = get_employee(employee_id)
    now = company_now()
    if employee.status == "inactive" or employee.join_date > now.date():
        abort(409, description="Only current employees can check in.")
    exists = db.session.execute(
        db.select(Attendance).where(
            Attendance.employee_id == employee_id, Attendance.date == now.date()
        )
    ).scalar_one_or_none()
    if exists:
        abort(409, description="This employee has already checked in today.")
    on_leave = (
        db.session.execute(
            db.select(LeaveRequest).where(
                LeaveRequest.employee_id == employee_id,
                LeaveRequest.status == "approved",
                LeaveRequest.start_date <= now.date(),
                LeaveRequest.end_date >= now.date(),
            )
        )
        .scalars()
        .first()
    )
    if on_leave:
        abort(409, description="This employee has approved leave today.")
    record = Attendance(
        employee_id=employee_id,
        date=now.date(),
        check_in=now.astimezone(timezone.utc),
        work_mode=choice(data, "work_mode", ("office", "remote"), default="office"),
    )
    db.session.add(record)
    commit("This employee has already checked in today.")
    return {"attendance": attendance_dict(employee, now.date(), record)}, 201


@bp.post("/attendance/check-out")
def check_out():
    data = payload({"employee_id"})
    employee_id = integer(data.get("employee_id"), "employee_id")
    require_employee_access(employee_id)
    employee = get_employee(employee_id)
    now = company_now()
    record = db.session.execute(
        db.select(Attendance).where(
            Attendance.employee_id == employee_id, Attendance.date == now.date()
        )
    ).scalar_one_or_none()
    if record is None:
        abort(409, description="Check in before checking out.")
    if record.check_out is not None:
        abort(409, description="This employee has already checked out today.")
    record.check_out = now.astimezone(timezone.utc)
    commit()
    return {"attendance": attendance_dict(employee, now.date(), record)}


def job_values(data, partial=False):
    values = {}
    for field, maximum in (
        ("title", 120),
        ("department", 80),
        ("location", 100),
        ("description", 3000),
    ):
        required = field != "description"
        if field in data or (required and not partial):
            values[field] = string(data, field, required=required, maximum=maximum)
    if "employment_type" in data:
        values["employment_type"] = choice(data, "employment_type", EMPLOYMENT_TYPES)
    if "status" in data:
        values["status"] = choice(data, "status", ("open", "closed"))
    return values


@bp.get("/jobs")
def jobs():
    require_admin()
    rows = db.session.execute(db.select(Job).order_by(Job.created_at.desc())).scalars()
    candidates = db.session.execute(
        db.select(Applicant).order_by(Applicant.applied_at.desc())
    ).scalars()
    return {
        "jobs": [job_dict(item) for item in rows],
        "applicants": [applicant_dict(item) for item in candidates],
    }


@bp.post("/jobs")
def create_job():
    require_admin()
    job = Job(**job_values(payload(JOB_FIELDS)))
    db.session.add(job)
    commit()
    return {"job": job_dict(job)}, 201


@bp.patch("/jobs/<int:job_id>")
def update_job(job_id):
    require_admin()
    job = db.session.get(Job, job_id)
    if job is None:
        abort(404, description="Job not found.")
    for field, value in job_values(payload(JOB_FIELDS), partial=True).items():
        setattr(job, field, value)
    commit()
    return {"job": job_dict(job)}


@bp.post("/applicants")
def create_applicant():
    require_admin()
    data = payload({"job_id", "name", "email", "experience_years"})
    job_id = integer(data.get("job_id"), "job_id")
    job = db.session.get(Job, job_id)
    if job is None:
        abort(404, description="Job not found.")
    if job.status != "open":
        abort(409, description="This job is closed to new applicants.")
    applicant = Applicant(
        job_id=job_id,
        name=string(data, "name", required=True),
        email=email(data),
        experience_years=integer(
            data.get("experience_years", 0), "experience_years", 0, 60
        ),
    )
    db.session.add(applicant)
    commit("This applicant has already applied for this job.")
    return {"applicant": applicant_dict(applicant)}, 201


@bp.patch("/applicants/<int:applicant_id>")
def update_applicant(applicant_id):
    require_admin()
    applicant = db.session.get(Applicant, applicant_id)
    if applicant is None:
        abort(404, description="Applicant not found.")
    applicant.stage = choice(payload({"stage"}), "stage", APPLICANT_STAGES)
    commit()
    return {"applicant": applicant_dict(applicant)}


@bp.get("/announcements")
def announcements():
    rows = db.session.execute(
        db.select(Announcement).order_by(
            Announcement.pinned.desc(), Announcement.published_at.desc()
        )
    ).scalars()
    return {"announcements": [announcement_dict(item) for item in rows]}


@bp.post("/announcements")
def create_announcement():
    require_admin()
    data = payload({"title", "body", "category", "pinned"})
    pinned = data.get("pinned", False)
    if not isinstance(pinned, bool):
        abort(400, description="pinned must be true or false.")
    profile = current_profile()
    item = Announcement(
        title=string(data, "title", required=True, maximum=160),
        body=string(data, "body", required=True, maximum=4000),
        category=choice(
            data,
            "category",
            ("Company", "People", "Policy", "Event"),
            default="Company",
        ),
        pinned=pinned,
        author=profile.display_name or current_user().username,
    )
    db.session.add(item)
    commit()
    return {"announcement": announcement_dict(item)}, 201


@bp.get("/settings")
def settings():
    return {"settings": settings_dict()}


@bp.patch("/settings")
def update_settings():
    require_admin()
    data = payload(SETTINGS_DEFAULTS)
    values = {}
    for key, value in data.items():
        if key in ("annual_leave_days", "sick_leave_days"):
            values[key] = integer(value, key, 0, 365)
        elif key == "company_email":
            values[key] = email(data, key)
        elif key in ("work_start", "work_end"):
            value = string(data, key, required=True, maximum=5)
            try:
                time.fromisoformat(value)
                if not re.fullmatch(r"\d{2}:\d{2}", value):
                    raise ValueError
            except ValueError:
                abort(400, description=f"{key} must use 24-hour HH:MM format.")
            values[key] = value
        elif key == "timezone":
            value = string(data, key, required=True, maximum=80)
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError):
                abort(
                    400,
                    description="timezone must be a valid IANA timezone, such as Asia/Kolkata.",
                )
            values[key] = value
        else:
            values[key] = string(data, key, required=True, maximum=120)
    proposed = {**settings_dict(), **values}
    if proposed["work_end"] <= proposed["work_start"]:
        abort(
            400,
            description="work_end must be later than work_start for the same workday.",
        )
    for key, value in values.items():
        record = db.session.get(CompanySetting, key)
        if record:
            record.value = str(value)
        else:
            db.session.add(CompanySetting(key=key, value=str(value)))
    commit()
    g.pop("company_timezone", None)
    return settings()


@bp.get("/overview")
def overview():
    require_admin()
    today = company_now().date()
    staff = db.session.execute(db.select(Employee)).scalars().all()
    current_staff = [
        item for item in staff if item.status != "inactive" and item.join_date <= today
    ]
    _, attendance_summary = attendance_for_day(today)
    department_counts = Counter(item.department for item in current_staff)
    colors = (
        "#8b7af0",
        "#ffbe72",
        "#65c5aa",
        "#74a9ef",
        "#ed91b1",
        "#a4c46d",
        "#dd99ef",
    )
    departments = [
        {"name": name, "count": count, "color": colors[index % len(colors)]}
        for index, (name, count) in enumerate(sorted(department_counts.items()))
    ]
    headcount = []
    for offset in range(5, -1, -1):
        index = today.year * 12 + today.month - 1 - offset
        month_start = today.replace(year=index // 12, month=index % 12 + 1, day=1)
        next_index = index + 1
        next_month = month_start.replace(
            year=next_index // 12, month=next_index % 12 + 1
        )
        end = min(next_month - timedelta(days=1), today)
        headcount.append(
            {
                "month": month_start.strftime("%b"),
                "count": sum(item.join_date <= end for item in current_staff),
            }
        )
    trend = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        _, summary = attendance_for_day(day)
        trend.append(
            {
                "day": day.strftime("%a"),
                "date": day.isoformat(),
                "present": summary["present"],
                "remote": summary["remote"],
                "absent": summary["absent"],
            }
        )
    horizon = today + timedelta(days=30)
    approved = db.session.execute(
        db.select(LeaveRequest)
        .join(Employee, Employee.id == LeaveRequest.employee_id)
        .where(
            LeaveRequest.status == "approved",
            LeaveRequest.end_date >= today,
            LeaveRequest.start_date <= horizon,
            Employee.status != "inactive",
        )
        .order_by(LeaveRequest.start_date)
    ).scalars()
    events = [
        {
            "title": (
                f"{item.employee.name} · {item.type} leave"
                + (" (ongoing)" if item.start_date < today else "")
            ),
            "date": max(item.start_date, today).isoformat(),
            "type": "leave",
        }
        for item in approved
    ]
    for item in staff:
        if item.status == "inactive":
            continue
        if today <= item.join_date <= horizon:
            events.append(
                {
                    "title": f"Welcome {item.name}",
                    "date": item.join_date.isoformat(),
                    "type": "new_hire",
                }
            )
        elif item.join_date < today:
            # Celebrate February 29 anniversaries on February 28 in other years.
            anniversary = item.join_date.replace(
                year=today.year,
                day=min(
                    item.join_date.day, monthrange(today.year, item.join_date.month)[1]
                ),
            )
            if anniversary < today:
                anniversary = item.join_date.replace(
                    year=today.year + 1,
                    day=min(
                        item.join_date.day,
                        monthrange(today.year + 1, item.join_date.month)[1],
                    ),
                )
            years = anniversary.year - item.join_date.year
            if today <= anniversary <= horizon and years > 0:
                events.append(
                    {
                        "title": f"{item.name} · {years}-year work anniversary",
                        "date": anniversary.isoformat(),
                        "type": "anniversary",
                    }
                )
    total = attendance_summary["total"]
    metrics = {
        "total_employees": len(current_staff),
        "active_employees": len(
            [item for item in current_staff if item.status == "active"]
        ),
        "on_leave": attendance_summary["on_leave"],
        "open_positions": db.session.scalar(
            db.select(func.count(Job.id)).where(Job.status == "open")
        ),
        "pending_leaves": db.session.scalar(
            db.select(func.count(LeaveRequest.id)).where(
                LeaveRequest.status == "pending"
            )
        ),
        "attendance_rate": (
            round(
                (attendance_summary["present"] + attendance_summary["remote"])
                / total
                * 100,
                1,
            )
            if total
            else 0
        ),
        "total_departments": len(departments),
    }
    return {
        "metrics": metrics,
        "departments": departments,
        "headcount": headcount,
        "attendance_trend": trend,
        "recent_hires": [
            employee_dict(item)
            for item in sorted(
                current_staff, key=lambda entry: entry.join_date, reverse=True
            )[:5]
        ],
        "upcoming_events": sorted(
            events, key=lambda event: (event["date"], event["title"])
        )[:5],
    }
