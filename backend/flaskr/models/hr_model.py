"""HR records kept separate from the original task application's user table."""

from datetime import datetime, timezone

from flaskr.db import db


def utc_now():
    return datetime.now(timezone.utc)


class Employee(db.Model):
    __tablename__ = "hr_employees"

    id = db.Column(db.Integer, primary_key=True)
    employee_code = db.Column(db.String(20), unique=True, nullable=False)
    first_name = db.Column(db.String(60), nullable=False)
    last_name = db.Column(db.String(60), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30), nullable=False, default="")
    department = db.Column(db.String(80), nullable=False, index=True)
    job_title = db.Column(db.String(120), nullable=False)
    employment_type = db.Column(db.String(20), nullable=False, default="Full-time")
    status = db.Column(db.String(20), nullable=False, default="active", index=True)
    location = db.Column(db.String(100), nullable=False, default="Bengaluru")
    join_date = db.Column(db.Date, nullable=False)
    manager = db.Column(db.String(120), nullable=False, default="")
    avatar_color = db.Column(db.String(7), nullable=False, default="#7c6cf2")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)

    @property
    def name(self):
        return f"{self.first_name} {self.last_name}"


class HRProfile(db.Model):
    __tablename__ = "hr_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    employee_id = db.Column(
        db.Integer, db.ForeignKey("hr_employees.id"), unique=True, nullable=True
    )
    display_name = db.Column(db.String(100), nullable=False, default="")
    role = db.Column(db.String(20), nullable=False, default="employee")
    employee = db.relationship("Employee")


class LeaveRequest(db.Model):
    __tablename__ = "hr_leave_requests"

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(
        db.Integer, db.ForeignKey("hr_employees.id"), nullable=False
    )
    type = db.Column(db.String(20), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    days = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(1000), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending", index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    reviewed_at = db.Column(db.DateTime(timezone=True))
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    employee = db.relationship("Employee")


class Attendance(db.Model):
    __tablename__ = "hr_attendance"
    __table_args__ = (
        db.UniqueConstraint("employee_id", "date", name="uq_attendance_employee_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(
        db.Integer, db.ForeignKey("hr_employees.id"), nullable=False
    )
    date = db.Column(db.Date, nullable=False, index=True)
    check_in = db.Column(db.DateTime(timezone=True), nullable=False)
    check_out = db.Column(db.DateTime(timezone=True))
    work_mode = db.Column(db.String(20), nullable=False, default="office")
    employee = db.relationship("Employee")


class Job(db.Model):
    __tablename__ = "hr_jobs"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    department = db.Column(db.String(80), nullable=False)
    location = db.Column(db.String(100), nullable=False)
    employment_type = db.Column(db.String(20), nullable=False, default="Full-time")
    status = db.Column(db.String(20), nullable=False, default="open")
    description = db.Column(db.String(3000), nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    applicants = db.relationship("Applicant", back_populates="job")


class Applicant(db.Model):
    __tablename__ = "hr_applicants"
    __table_args__ = (
        db.UniqueConstraint("job_id", "email", name="uq_applicant_job_email"),
    )

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey("hr_jobs.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    experience_years = db.Column(db.Integer, nullable=False, default=0)
    stage = db.Column(db.String(20), nullable=False, default="applied")
    avatar_color = db.Column(db.String(7), nullable=False, default="#7c6cf2")
    applied_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    job = db.relationship("Job", back_populates="applicants")


class Announcement(db.Model):
    __tablename__ = "hr_announcements"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    body = db.Column(db.String(4000), nullable=False)
    category = db.Column(db.String(20), nullable=False, default="Company")
    author = db.Column(db.String(100), nullable=False)
    pinned = db.Column(db.Boolean, nullable=False, default=False)
    published_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utc_now
    )


class CompanySetting(db.Model):
    __tablename__ = "hr_settings"

    key = db.Column(db.String(60), primary_key=True)
    value = db.Column(db.Text, nullable=False)
