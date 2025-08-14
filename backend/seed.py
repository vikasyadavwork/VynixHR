"""Create the database and add fictional demo records once, without resetting edits.

Run ``python seed.py`` from backend/. Every name, email, and policy is sample data.
The launcher uses this command on every start; the marker makes reruns idempotent.
"""

from datetime import datetime, time, timedelta, timezone

from flaskr import create_app
from flaskr.db import db
from flaskr.hr_helpers import SETTINGS_DEFAULTS, company_now, company_zone
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
    UserModel,
)
from flaskr.utils import generate_password

# first name, last name, department, role, location, days since joining
EMPLOYEES = [
    ("Aditi", "Sharma", "People & Culture", "Head of People", "Bengaluru", 780),
    ("Arjun", "Mehta", "Engineering", "Engineering Manager", "Bengaluru", 690),
    ("Priya", "Nair", "Design", "Lead Product Designer", "Kochi", 610),
    ("Rohan", "Verma", "Engineering", "Senior Frontend Engineer", "Pune", 530),
    ("Ananya", "Iyer", "Product", "Senior Product Manager", "Chennai", 475),
    ("Kabir", "Khan", "Marketing", "Growth Marketing Lead", "Mumbai", 430),
    ("Sneha", "Patel", "Finance", "Finance Manager", "Ahmedabad", 402),
    ("Ishaan", "Das", "Engineering", "Backend Engineer", "Kolkata", 380),
    (
        "Meera",
        "Reddy",
        "People & Culture",
        "People Operations Specialist",
        "Hyderabad",
        342,
    ),
    ("Vivek", "Singh", "Sales", "Account Executive", "New Delhi", 318),
    ("Zoya", "Ali", "Design", "UX Researcher", "Mumbai", 290),
    ("Dev", "Joshi", "Engineering", "DevOps Engineer", "Bengaluru", 265),
    ("Kavya", "Menon", "Marketing", "Content Strategist", "Kochi", 245),
    ("Aditya", "Rao", "Product", "Product Analyst", "Hyderabad", 222),
    ("Simran", "Kaur", "Sales", "Customer Success Manager", "Chandigarh", 210),
    ("Neel", "Shah", "Engineering", "Full Stack Engineer", "Ahmedabad", 188),
    ("Fatima", "Sheikh", "Finance", "Financial Analyst", "Lucknow", 170),
    ("Karthik", "Pillai", "Engineering", "QA Automation Engineer", "Chennai", 155),
    ("Tara", "Bose", "Design", "Product Designer", "Kolkata", 137),
    ("Siddharth", "Gupta", "Sales", "Sales Development Representative", "Jaipur", 118),
    (
        "Nisha",
        "Kulkarni",
        "People & Culture",
        "Talent Acquisition Specialist",
        "Pune",
        97,
    ),
    ("Rahul", "Choudhury", "Engineering", "Mobile Engineer", "Guwahati", 76),
    ("Pooja", "Bhat", "Marketing", "Brand Designer", "Mangaluru", 61),
    ("Aarav", "Malhotra", "Product", "Associate Product Manager", "New Delhi", 45),
    ("Riya", "Thomas", "Engineering", "Frontend Engineer", "Bengaluru", 22),
    ("Sameer", "Ansari", "Sales", "Account Executive", "Lucknow", 14),
    ("Diya", "Sen", "Design", "Design Intern", "Kolkata", 7),
    ("Lakshmi", "Krishnan", "Engineering", "Data Engineer", "Chennai", 3),
]

COLORS = ("#8b7af0", "#e4936a", "#62b69d", "#6999d8", "#ce7dac", "#a0ab62")
MANAGERS = {
    "People & Culture": "Aditi Sharma",
    "Engineering": "Arjun Mehta",
    "Design": "Priya Nair",
    "Product": "Ananya Iyer",
    "Marketing": "Kabir Khan",
    "Finance": "Sneha Patel",
    "Sales": "Vivek Singh",
}


def demo_user(username, address, display_name, role, employee):
    user = db.session.execute(
        db.select(UserModel).where(UserModel.email == address)
    ).scalar_one_or_none()
    if user is None:
        user = UserModel(
            username=username, email=address, password=generate_password("Welcome@123")
        )
        db.session.add(user)
        db.session.flush()
        db.session.add(
            HRProfile(
                user_id=user.id,
                employee_id=employee.id,
                display_name=display_name,
                role=role,
            )
        )
    # Never elevate an existing account just because its email matches demo data.
    return user


def seed_demo_data():
    """Seed within an active application context; return True only on first run."""
    db.create_all()
    if db.session.get(CompanySetting, "demo_seed_version"):
        return False

    for key, value in SETTINGS_DEFAULTS.items():
        if db.session.get(CompanySetting, key) is None:
            db.session.add(CompanySetting(key=key, value=str(value)))
    db.session.flush()
    now = company_now()
    zone = company_zone()
    today = now.date()
    staff = []
    for index, (first, last, department, title, location, days_ago) in enumerate(
        EMPLOYEES
    ):
        address = f"{first.lower()}.{last.lower()}@vynixhr.local"
        employee = db.session.execute(
            db.select(Employee).where(Employee.email == address)
        ).scalar_one_or_none()
        if employee is None:
            employee = Employee(
                employee_code=f"VNX-{1001 + index}",
                first_name=first,
                last_name=last,
                email=address,
                phone=f"+91 00000 {10000 + index:05d}",
                department=department,
                job_title=title,
                location=location,
                join_date=today - timedelta(days=days_ago),
                manager=(
                    MANAGERS[department]
                    if MANAGERS[department] != f"{first} {last}"
                    else "Leadership team"
                ),
                avatar_color=COLORS[index % len(COLORS)],
                employment_type="Intern" if "Intern" in title else "Full-time",
                status="inactive" if index == 19 else "active",
            )
            db.session.add(employee)
            db.session.flush()
        staff.append(employee)

    admin = demo_user(
        "vynix-admin", "admin@vynixhr.local", "Aditi Sharma", "admin", staff[0]
    )
    demo_user(
        "vynix-employee", "employee@vynixhr.local", "Riya Thomas", "employee", staff[24]
    )

    leave_specs = [
        (4, "Annual", 4, 6, "Family holiday planned in advance.", "pending"),
        (10, "Casual", 2, 2, "Personal appointment.", "pending"),
        (17, "Sick", 1, 2, "Rest and recovery.", "pending"),
        (22, "Annual", 12, 16, "Visiting family.", "pending"),
        (7, "Annual", -1, 2, "Family celebration.", "approved"),
        (12, "Casual", 0, 0, "Personal commitments.", "approved"),
        (15, "Annual", 8, 10, "Planned time away.", "approved"),
        (8, "Sick", -8, -7, "Medical rest.", "approved"),
        (
            11,
            "Annual",
            -14,
            -12,
            "Travel plans changed; request was not approved.",
            "rejected",
        ),
        (2, "Casual", -5, -5, "Personal appointment.", "approved"),
    ]
    for index, (person, kind, start, end, reason, status) in enumerate(leave_specs):
        db.session.add(
            LeaveRequest(
                employee_id=staff[person].id,
                type=kind,
                start_date=today + timedelta(days=start),
                end_date=today + timedelta(days=end),
                days=end - start + 1,
                reason=reason,
                status=status,
                created_at=(now - timedelta(days=2 + index)).astimezone(timezone.utc),
                reviewed_at=(
                    (now - timedelta(days=1)).astimezone(timezone.utc)
                    if status != "pending"
                    else None
                ),
                reviewed_by=admin.id if status != "pending" else None,
            )
        )
    db.session.flush()
    all_leaves = (
        db.session.execute(
            db.select(LeaveRequest).where(LeaveRequest.status == "approved")
        )
        .scalars()
        .all()
    )

    for days_ago in range(14):
        day = today - timedelta(days=days_ago)
        for index, employee in enumerate(staff):
            if employee.status == "inactive" or employee.join_date > day:
                continue
            if any(
                item.employee_id == employee.id
                and item.start_date <= day <= item.end_date
                for item in all_leaves
            ):
                continue
            if (index + days_ago) % 13 == 0:
                continue
            start = datetime.combine(day, time(9, index % 4 * 7), zone)
            end = datetime.combine(day, time(18, index % 3 * 9), zone)
            if days_ago == 0:
                start = min(start, now - timedelta(minutes=1))
            db.session.add(
                Attendance(
                    employee_id=employee.id,
                    date=day,
                    check_in=start.astimezone(timezone.utc),
                    check_out=end.astimezone(timezone.utc) if days_ago > 0 else None,
                    work_mode="remote" if index % 4 == 2 else "office",
                )
            )

    job_specs = [
        (
            "Senior Frontend Engineer",
            "Engineering",
            "Bengaluru / Hybrid",
            "Build thoughtful employee experiences with React and accessible UI.",
        ),
        (
            "Product Designer",
            "Design",
            "Remote, India",
            "Turn complex people workflows into simple, inclusive product experiences.",
        ),
        (
            "People Operations Associate",
            "People & Culture",
            "Bengaluru",
            "Support onboarding, employee engagement, and a caring workplace.",
        ),
        (
            "Growth Marketing Specialist",
            "Marketing",
            "Mumbai / Hybrid",
            "Plan useful content and measurable campaigns for our growing product.",
        ),
        (
            "Backend Engineer",
            "Engineering",
            "Pune / Hybrid",
            "Build reliable Python services and well-tested data integrations.",
        ),
        (
            "Customer Success Manager",
            "Sales",
            "New Delhi",
            "Help customers build lasting value with our products.",
        ),
    ]
    jobs = []
    for index, (title, department, location, description) in enumerate(job_specs):
        job = Job(
            title=title,
            department=department,
            location=location,
            description=description,
            status="closed" if index == 5 else "open",
            created_at=now - timedelta(days=6 + index * 3),
        )
        db.session.add(job)
        db.session.flush()
        jobs.append(job)
    candidates = [
        ("Avni Desai", 0, "interview", 5),
        ("Yash Kapoor", 0, "screening", 4),
        ("Sana Mirza", 1, "offer", 6),
        ("Rehan Qureshi", 1, "interview", 3),
        ("Maya Dutta", 2, "applied", 2),
        ("Harsh Sethi", 3, "screening", 4),
        ("Anika George", 4, "interview", 5),
        ("Rishi Bansal", 4, "applied", 3),
        ("Noor Siddiqui", 0, "applied", 4),
        ("Soham Pal", 1, "screening", 2),
        ("Vedika Jain", 2, "interview", 3),
        ("Kunal Sood", 5, "hired", 7),
    ]
    for index, (name, job_index, stage, experience) in enumerate(candidates):
        db.session.add(
            Applicant(
                job_id=jobs[job_index].id,
                name=name,
                email=f"{name.lower().replace(' ', '.')}@example.com",
                experience_years=experience,
                stage=stage,
                avatar_color=COLORS[index % len(COLORS)],
                applied_at=(now - timedelta(days=index % 9 + 1)).astimezone(
                    timezone.utc
                ),
            )
        )

    announcements = [
        (
            "A little more room to grow",
            "Our new learning allowance is here. Explore a course, pick up a book, or join a workshop. Speak with your manager and People team to plan your next learning goal.",
            "People",
            True,
        ),
        (
            "Welcome to the team, Riya, Diya & Lakshmi!",
            "Three new perspectives, one growing team. Drop by the introductions channel and help our newest colleagues feel at home.",
            "Company",
            False,
        ),
        (
            "Your time off, made simpler",
            "You can now request time off and follow its approval in the Leaves page. Please check with People & Culture for your current balance before making travel plans.",
            "Policy",
            False,
        ),
        (
            "Friday is for sharing ideas",
            "Bring something you have learned to our next team demo. A five-minute story, a small improvement, or a question is all it takes.",
            "Event",
            False,
        ),
    ]
    for index, (title, body, category, pinned) in enumerate(announcements):
        db.session.add(
            Announcement(
                title=title,
                body=body,
                category=category,
                pinned=pinned,
                author="Aditi Sharma",
                published_at=(now - timedelta(days=index)).astimezone(timezone.utc),
            )
        )
    for name in ("Work", "Meetings", "Learning", "Projects", "Urgent", "Goals"):
        if (
            db.session.execute(
                db.select(TagModel).where(TagModel.name == name)
            ).scalar_one_or_none()
            is None
        ):
            db.session.add(TagModel(name=name))
    db.session.add(CompanySetting(key="demo_seed_version", value="1"))
    db.session.commit()
    return True


def main():
    app = create_app()
    with app.app_context():
        try:
            created = seed_demo_data()
            print(
                "Created 28 fictional employees, attendance, leave requests, jobs and announcements."
                if created
                else "Database ready; existing demo data and edits preserved."
            )
        except Exception:
            db.session.rollback()
            raise


if __name__ == "__main__":
    main()
