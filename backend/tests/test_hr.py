"""Integration checks for persistence, permissions, and stateful HR workflows."""

import json
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch
from urllib.error import URLError

from flask_jwt_extended import create_access_token

from flaskr import create_app
from flaskr.db import db
from flaskr.models import (
    Announcement,
    Applicant,
    Attendance,
    CompanySetting,
    Employee,
    HRProfile,
    Job,
    LeaveRequest,
    TagModel,
    TaskModel,
    UserModel,
)
from flaskr.utils import generate_password
from seed import seed_demo_data


class HRIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = generate_password("Welcome@123")

    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                "JWT_SECRET_KEY": "integration-test-secret-with-at-least-32-characters",
            }
        )
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        self.admin = UserModel(
            username="admin", email="admin@test.local", password=self.password_hash
        )
        self.user = UserModel(
            username="employee",
            email="employee@test.local",
            password=self.password_hash,
        )
        db.session.add_all([self.admin, self.user])
        db.session.flush()
        self.employee = Employee(
            employee_code="TEST-01",
            first_name="Test",
            last_name="Employee",
            email="test@example.com",
            department="Engineering",
            job_title="Engineer",
            join_date=date.today() - timedelta(days=200),
        )
        self.other_employee = Employee(
            employee_code="TEST-02",
            first_name="Other",
            last_name="Employee",
            email="other@example.com",
            department="Design",
            job_title="Designer",
            join_date=date.today() - timedelta(days=200),
        )
        db.session.add_all([self.employee, self.other_employee])
        db.session.flush()
        db.session.add_all(
            [
                HRProfile(user_id=self.admin.id, display_name="HR Admin", role="admin"),
                HRProfile(
                    user_id=self.user.id,
                    employee_id=self.employee.id,
                    display_name="Test Employee",
                    role="employee",
                ),
            ]
        )
        db.session.commit()
        self.client = self.app.test_client()
        self.admin_headers = {
            "Authorization": f"Bearer {create_access_token(identity=str(self.admin.id))}"
        }
        self.user_headers = {
            "Authorization": f"Bearer {create_access_token(identity=str(self.user.id))}"
        }

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.context.pop()

    def post(self, path, data, *, employee=False):
        return self.client.post(
            f"/api/v1/hr{path}",
            json=data,
            headers=self.user_headers if employee else self.admin_headers,
        )

    def leave_payload(self, **overrides):
        data = {
            "employee_id": self.employee.id,
            "type": "Annual",
            "start_date": (date.today() + timedelta(days=2)).isoformat(),
            "end_date": (date.today() + timedelta(days=4)).isoformat(),
            "reason": "Family holiday",
        }
        return {**data, **overrides}

    def test_public_health_and_protected_data(self):
        self.assertEqual(self.client.get("/api/v1/health").status_code, 200)
        for path in (
            "/hr/employees",
            "/hr/overview",
            "/hr/leaves",
            "/hr/attendance",
            "/ai/status",
            "/users",
        ):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(f"/api/v1{path}").status_code, 401)

    def test_login_and_invalid_credentials(self):
        response = self.client.post(
            "/api/v1/auth/sign-in",
            json={"email": "ADMIN@TEST.LOCAL", "password": "Welcome@123"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.json)
        response = self.client.post(
            "/api/v1/auth/sign-in",
            json={"email": "admin@test.local", "password": "wrong"},
        )
        self.assertEqual(response.status_code, 401)

    def test_registration_cannot_gain_administrator_access(self):
        response = self.client.post(
            "/api/v1/users",
            json={
                "username": "new-user",
                "email": "new@example.com",
                "password": "Welcome@123",
            },
        )
        self.assertEqual(response.status_code, 201)
        token = self.client.post(
            "/api/v1/auth/sign-in",
            json={"email": "new@example.com", "password": "Welcome@123"},
        ).json["token"]
        headers = {"Authorization": f"Bearer {token}"}
        self.assertEqual(
            self.client.get("/api/v1/hr/me", headers=headers).json["user"]["role"],
            "employee",
        )
        self.assertEqual(
            self.client.get("/api/v1/hr/employees", headers=headers).json["employees"],
            [],
        )
        self.assertEqual(
            self.client.get("/api/v1/hr/overview", headers=headers).status_code, 403
        )
        self.assertEqual(
            self.client.patch(
                "/api/v1/hr/profile", headers=headers, json={"role": "admin"}
            ).status_code,
            400,
        )

    def test_employee_cannot_read_others_or_mutate_administrator_resources(self):
        own_list = self.client.get(
            "/api/v1/hr/employees", headers=self.user_headers
        ).json["employees"]
        self.assertEqual([item["id"] for item in own_list], [self.employee.id])
        self.assertEqual(
            self.client.get(
                f"/api/v1/hr/employees/{self.other_employee.id}",
                headers=self.user_headers,
            ).status_code,
            403,
        )
        self.assertEqual(self.post("/employees", {}, employee=True).status_code, 403)
        self.assertEqual(self.post("/jobs", {}, employee=True).status_code, 403)
        self.assertEqual(
            self.client.patch(
                "/api/v1/hr/settings",
                headers=self.user_headers,
                json={"company_name": "Changed"},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.post(
                "/leaves",
                self.leave_payload(employee_id=self.other_employee.id),
                employee=True,
            ).status_code,
            403,
        )

    def test_employee_create_filter_update_archive(self):
        response = self.post(
            "/employees",
            {
                "first_name": "Nila",
                "last_name": "Rao",
                "email": "nila@example.com",
                "department": "Engineering",
                "job_title": "Developer",
                "join_date": "2025-12-01",
            },
        )
        self.assertEqual(response.status_code, 201, response.json)
        employee_id = response.json["employee"]["id"]
        rows = self.client.get(
            "/api/v1/hr/employees?search=Nila%20Rao&department=Engineering&status=active",
            headers=self.admin_headers,
        ).json["employees"]
        self.assertEqual([item["id"] for item in rows], [employee_id])
        response = self.client.patch(
            f"/api/v1/hr/employees/{employee_id}",
            headers=self.admin_headers,
            json={"job_title": "Senior Developer"},
        )
        self.assertEqual(response.json["employee"]["job_title"], "Senior Developer")
        response = self.client.delete(
            f"/api/v1/hr/employees/{employee_id}", headers=self.admin_headers
        )
        self.assertEqual(response.json["employee"]["status"], "inactive")
        self.assertIsNotNone(db.session.get(Employee, employee_id))

    def test_employee_rejects_invalid_dates_emails_and_duplicates(self):
        data = {
            "first_name": "New",
            "last_name": "Person",
            "email": "new@example.com",
            "department": "Design",
            "job_title": "Designer",
            "join_date": "2025-12-01",
        }
        for field, value in (
            ("email", "invalid"),
            ("join_date", "2025-02-30"),
            ("first_name", " "),
            ("status", "unknown"),
            ("avatar_color", "javascript:alert(1)"),
        ):
            with self.subTest(field=field):
                self.assertEqual(
                    self.post("/employees", {**data, field: value}).status_code, 400
                )
        self.assertEqual(
            self.post("/employees", {**data, "email": self.employee.email}).status_code,
            409,
        )

    def test_leave_lifecycle_overlap_and_review_permissions(self):
        response = self.post("/leaves", self.leave_payload(), employee=True)
        self.assertEqual(response.status_code, 201, response.json)
        leave_id = response.json["leave"]["id"]
        self.assertEqual(response.json["leave"]["days"], 3)
        self.assertEqual(
            self.post("/leaves", self.leave_payload(), employee=True).status_code, 409
        )
        path = f"/api/v1/hr/leaves/{leave_id}"
        self.assertEqual(
            self.client.patch(
                path, json={"status": "approved"}, headers=self.user_headers
            ).status_code,
            403,
        )
        response = self.client.patch(
            path, json={"status": "approved"}, headers=self.admin_headers
        )
        self.assertEqual(response.json["leave"]["status"], "approved")
        self.assertEqual(
            self.client.patch(
                path, json={"status": "rejected"}, headers=self.admin_headers
            ).status_code,
            409,
        )

    def test_leave_rejects_reverse_dates_and_unknown_fields(self):
        self.assertEqual(
            self.post("/leaves", self.leave_payload(end_date="2020-01-01")).status_code,
            400,
        )
        self.assertEqual(
            self.post("/leaves", self.leave_payload(status="approved")).status_code, 400
        )
        self.assertEqual(
            self.post("/leaves", self.leave_payload(employee_id=True)).status_code, 400
        )

    def test_check_in_out_persists_and_rejects_duplicate_events(self):
        data = {"employee_id": self.employee.id}
        self.assertEqual(
            self.post("/attendance/check-out", data, employee=True).status_code, 409
        )
        response = self.post(
            "/attendance/check-in", {**data, "work_mode": "remote"}, employee=True
        )
        self.assertEqual(response.status_code, 201, response.json)
        self.assertEqual(response.json["attendance"]["status"], "remote")
        self.assertEqual(
            self.post("/attendance/check-in", data, employee=True).status_code, 409
        )
        response = self.post("/attendance/check-out", data, employee=True)
        self.assertEqual(response.status_code, 200, response.json)
        self.assertIsNotNone(response.json["attendance"]["check_out"])
        self.assertGreaterEqual(response.json["attendance"]["hours"], 0)
        self.assertEqual(
            self.post("/attendance/check-out", data, employee=True).status_code, 409
        )
        rows = self.client.get("/api/v1/hr/attendance", headers=self.user_headers).json[
            "attendance"
        ]
        self.assertEqual(len(rows), 1)

    def test_attendance_respects_approved_leave_and_employee_access(self):
        from flaskr.hr_helpers import company_now

        today = company_now().date().isoformat()
        response = self.post(
            "/leaves", self.leave_payload(start_date=today, end_date=today)
        )
        leave_id = response.json["leave"]["id"]
        self.client.patch(
            f"/api/v1/hr/leaves/{leave_id}",
            headers=self.admin_headers,
            json={"status": "approved"},
        )
        self.assertEqual(
            self.post(
                "/attendance/check-in", {"employee_id": self.employee.id}, employee=True
            ).status_code,
            409,
        )
        self.assertEqual(
            self.post(
                "/attendance/check-in",
                {"employee_id": self.other_employee.id},
                employee=True,
            ).status_code,
            403,
        )
        response = self.client.get("/api/v1/hr/attendance", headers=self.admin_headers)
        self.assertEqual(response.json["summary"]["on_leave"], 1)

    def test_job_and_applicant_pipeline(self):
        job = self.post(
            "/jobs",
            {"title": "Engineer", "department": "Engineering", "location": "Remote"},
        )
        self.assertEqual(job.status_code, 201)
        job_id = job.json["job"]["id"]
        data = {
            "job_id": job_id,
            "name": "Demo Candidate",
            "email": "candidate@example.com",
            "experience_years": 3,
        }
        candidate = self.post("/applicants", data)
        self.assertEqual(candidate.status_code, 201)
        self.assertEqual(self.post("/applicants", data).status_code, 409)
        path = f"/api/v1/hr/applicants/{candidate.json['applicant']['id']}"
        self.assertEqual(
            self.client.patch(
                path, json={"stage": "interview"}, headers=self.admin_headers
            ).json["applicant"]["stage"],
            "interview",
        )
        self.assertEqual(
            self.client.patch(
                path, json={"stage": "unknown"}, headers=self.admin_headers
            ).status_code,
            400,
        )
        self.client.patch(
            f"/api/v1/hr/jobs/{job_id}",
            headers=self.admin_headers,
            json={"status": "closed"},
        )
        self.assertEqual(
            self.post(
                "/applicants", {**data, "email": "second@example.com"}
            ).status_code,
            409,
        )

    def test_settings_validation_and_profile_permissions(self):
        path = "/api/v1/hr/settings"
        for values in (
            {"work_start": "25:00"},
            {"annual_leave_days": -1},
            {"timezone": "Invalid/Zone"},
            {"work_start": "20:00", "work_end": "18:00"},
        ):
            self.assertEqual(
                self.client.patch(
                    path, json=values, headers=self.admin_headers
                ).status_code,
                400,
            )
        response = self.client.patch(
            path,
            json={"company_name": "Test Company", "annual_leave_days": 20},
            headers=self.admin_headers,
        )
        self.assertEqual(response.json["settings"]["annual_leave_days"], 20)
        response = self.client.patch(
            "/api/v1/hr/profile",
            json={"name": "Updated Name"},
            headers=self.user_headers,
        )
        self.assertEqual(response.json["user"]["name"], "Updated Name")
        self.assertEqual(response.json["user"]["role"], "employee")

    def test_announcements_and_overview_are_backed_by_records(self):
        response = self.post(
            "/announcements",
            {
                "title": "Welcome",
                "body": "Hello team",
                "category": "People",
                "pinned": True,
            },
        )
        self.assertEqual(response.status_code, 201)
        rows = self.client.get(
            "/api/v1/hr/announcements", headers=self.user_headers
        ).json["announcements"]
        self.assertEqual(rows[0]["title"], "Welcome")
        metrics = self.client.get(
            "/api/v1/hr/overview", headers=self.admin_headers
        ).json["metrics"]
        self.assertEqual(metrics["total_employees"], 2)
        self.assertEqual(metrics["total_departments"], 2)

    def test_ai_proxy_validation_fallback_and_response(self):
        path = "/api/v1/ai/chat"
        for data in (
            {"message": ""},
            {"message": "a" * 2001},
            {"message": 12},
            {"message": "hello", "employee_id": 1},
        ):
            self.assertEqual(
                self.client.post(
                    path, headers=self.admin_headers, json=data
                ).status_code,
                400,
            )
        with patch("flaskr.routes.ai_route.urlopen", side_effect=URLError("offline")):
            response = self.client.post(
                path,
                headers=self.admin_headers,
                json={"message": "How do I apply for leave?"},
            )
            self.assertEqual(response.status_code, 503)
            self.assertIn("unavailable", response.json["message"])
        with patch("flaskr.routes.ai_route.urlopen") as mocked:
            mocked.return_value.__enter__.return_value.read.return_value = json.dumps(
                {"answer": "Open Leaves.", "confidence": 0.9}
            ).encode()
            response = self.client.post(
                path,
                headers=self.admin_headers,
                json={"message": "How do I apply for leave?"},
            )
            self.assertEqual(response.json["answer"], "Open Leaves.")

    def test_original_tasks_are_isolated_by_owner(self):
        tag = TagModel(name="Work")
        db.session.add(tag)
        db.session.flush()
        task = TaskModel(
            title="Private task",
            content="Only admin sees this",
            status="PENDING",
            user_id=self.admin.id,
            tag_id=tag.id,
        )
        db.session.add(task)
        db.session.commit()
        self.assertEqual(
            self.client.get("/api/v1/tasks/user", headers=self.user_headers).json, []
        )
        self.assertEqual(
            len(self.client.get("/api/v1/tasks/user", headers=self.admin_headers).json),
            1,
        )
        path = f"/api/v1/tasks/{task.id}"
        self.assertEqual(
            self.client.put(
                path,
                json={"title": "Changed", "content": "Changed", "status": "COMPLETED"},
                headers=self.user_headers,
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(path, headers=self.user_headers).status_code, 404
        )

    def test_deleted_account_token_and_profile_are_invalidated(self):
        user_id = self.user.id
        self.assertEqual(
            self.client.delete(
                "/api/v1/users/account", headers=self.user_headers
            ).status_code,
            204,
        )
        self.assertIsNone(
            db.session.execute(
                db.select(HRProfile).where(HRProfile.user_id == user_id)
            ).scalar_one_or_none()
        )
        self.assertEqual(
            self.client.get("/api/v1/hr/me", headers=self.user_headers).status_code, 401
        )

    def test_upcoming_events_exclude_past_hires_and_sort_current_future_dates(self):
        today = date(2026, 9, 5)
        self.employee.join_date = date(2026, 9, 2)
        self.other_employee.join_date = date(2024, 9, 9)
        for index, join_day in enumerate((7, 20, 21)):
            db.session.add(
                Employee(
                    employee_code=f"UPCOMING-{index}",
                    first_name=f"Future{index}",
                    last_name="Hire",
                    email=f"future{index}@example.com",
                    department="Engineering",
                    job_title="Engineer",
                    join_date=date(2026, 9, join_day),
                )
            )
        for start, end in ((1, 1), (3, 6), (10, 11)):
            db.session.add(
                LeaveRequest(
                    employee_id=self.employee.id,
                    type="Annual",
                    start_date=date(2026, 9, start),
                    end_date=date(2026, 9, end),
                    days=end - start + 1,
                    reason="Planned leave",
                    status="approved",
                )
            )
        db.session.commit()
        with patch(
            "flaskr.routes.hr_route.company_now",
            return_value=datetime(2026, 9, 5, 12, tzinfo=timezone.utc),
        ):
            response = self.client.get(
                "/api/v1/hr/overview", headers=self.admin_headers
            )
        events = response.json["upcoming_events"]
        dates = [event["date"] for event in events]
        self.assertEqual(len(events), 5)
        self.assertEqual(dates, sorted(dates))
        self.assertTrue(
            all(
                today <= date.fromisoformat(value) <= today + timedelta(days=30)
                for value in dates
            )
        )
        self.assertEqual(
            dates,
            ["2026-09-05", "2026-09-07", "2026-09-09", "2026-09-10", "2026-09-20"],
        )
        self.assertIn("ongoing", events[0]["title"])
        self.assertEqual(events[1]["type"], "new_hire")
        self.assertEqual(events[2]["type"], "anniversary")
        self.assertFalse(
            any(event["title"] == f"Welcome {self.employee.name}" for event in events)
        )

    def test_seed_is_idempotent_and_preserves_edits(self):
        self.assertTrue(seed_demo_data())
        models = (
            Employee,
            UserModel,
            HRProfile,
            Attendance,
            LeaveRequest,
            Job,
            Applicant,
            Announcement,
            CompanySetting,
        )
        counts = {
            model.__tablename__: db.session.query(model).count() for model in models
        }
        self.assertGreaterEqual(counts["hr_employees"], 28)
        seeded = db.session.execute(
            db.select(Employee).where(Employee.email == "aditi.sharma@vynixhr.local")
        ).scalar_one()
        seeded.job_title = "User-edited title"
        db.session.commit()
        self.assertFalse(seed_demo_data())
        self.assertEqual(
            counts,
            {model.__tablename__: db.session.query(model).count() for model in models},
        )
        self.assertEqual(seeded.job_title, "User-edited title")
        response = self.client.post(
            "/api/v1/auth/sign-in",
            json={"email": "admin@vynixhr.local", "password": "Welcome@123"},
        )
        self.assertEqual(response.status_code, 200)
        response = self.client.get(
            "/api/v1/hr/overview",
            headers={"Authorization": f"Bearer {response.json['token']}"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["metrics"]["open_positions"], 5)


if __name__ == "__main__":
    unittest.main()
