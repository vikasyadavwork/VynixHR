import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { formatDate, today, useApi } from "./api";
import type { Announcement, CurrentUser, Overview } from "./types";
import {
  Avatar,
  Badge,
  Button,
  CardTitle,
  Empty,
  ErrorState,
  Loading,
  PageTitle,
  TextLink,
} from "./ui";

export function Dashboard() {
  const currentQuery = useApi<CurrentUser>("/hr/me");
  const current = currentQuery.data;
  const query = useApi<Overview>("/hr/overview", current?.user.role === "admin");
  const { data: news } = useApi<{ announcements: Announcement[] }>("/hr/announcements");
  const navigate = useNavigate();
  if (currentQuery.error) {
    return <ErrorState error={currentQuery.error} retry={() => void currentQuery.refetch()} />;
  }
  if (current && current.user.role !== "admin") return <Navigate to="/employees" replace />;
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const metrics = [
    {
      title: "Current employees",
      value: data.metrics.total_employees,
      icon: Users,
      detail: `${data.metrics.total_departments} departments working together`,
      color: "purple",
    },
    {
      title: "Attendance today",
      value: `${data.metrics.attendance_rate}%`,
      icon: Clock3,
      detail: "Office and remote check-ins",
      color: "green",
    },
    {
      title: "On leave today",
      value: data.metrics.on_leave,
      icon: CalendarDays,
      detail: `${data.metrics.pending_leaves} requests awaiting approval`,
      color: "orange",
    },
    {
      title: "Open positions",
      value: data.metrics.open_positions,
      icon: BriefcaseBusiness,
      detail: "Find your next great teammate",
      color: "blue",
    },
  ];
  const departmentTotal = data.departments.reduce((sum, department) => sum + department.count, 0);
  let gradientStart = 0;
  const gradient = data.departments
    .map((department) => {
      const start = gradientStart;
      gradientStart += (department.count / Math.max(departmentTotal, 1)) * 100;
      return `${department.color} ${start}% ${gradientStart}%`;
    })
    .join(",");
  const maxAttendance = Math.max(
    ...data.attendance_trend.map((day) => day.present + day.remote + day.absent),
    1,
  );

  return (
    <>
      <PageTitle
        eyebrow="YOUR PEOPLE AT A GLANCE"
        title={`Hello, ${current?.user.name.split(" ")[0] || "there"} 👋`}
        description="Here’s what’s happening with your team today."
        actions={
          <>
            <span className="date-chip">
              <CalendarDays size={16} />
              {formatDate(today(), true)}, {new Date().getFullYear()}
            </span>
            <Button onClick={() => navigate("/employees?add=true")}>
              <Plus size={17} />
              Add employee
            </Button>
          </>
        }
      />
      <div className="welcome-banner">
        <div className="banner-copy">
          <span className="banner-label">
            <i /> PEOPLE FIRST, ALWAYS
          </span>
          <h2>
            A great workplace starts with <em>you.</em>
          </h2>
          <p>A little less admin. A little more human. Let’s make today count.</p>
          <button onClick={() => navigate("/assistant")}>
            Get a little help from Vynix AI <ArrowRight size={16} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <span className="art-spark">✳</span>
          <div className="art-chip art-chip-one">
            <Users size={22} />
          </div>
          <div className="art-chip art-chip-two">
            <TrendingUp size={22} />
          </div>
          <div className="art-chip art-chip-three">
            <Sparkles size={21} />
          </div>
          <span className="art-dot art-dot-one" />
          <span className="art-dot art-dot-two" />
        </div>
      </div>
      <div className="metrics-grid">
        {metrics.map(({ title, value, icon: Icon, detail, color }, index) => (
          <button
            key={title}
            className="metric-card"
            onClick={() =>
              navigate(["/employees", "/attendance", "/leaves", "/recruitment"][index])
            }
          >
            <div className="metric-top">
              <span>{title}</span>
              <span className={`metric-icon ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <div className="metric-value">
              {value}
              <ArrowUpRight size={18} />
            </div>
            <div className="metric-detail">
              <i className={color} />
              {detail}
            </div>
          </button>
        ))}
      </div>
      <div className="dashboard-charts">
        <section className="panel attendance-chart">
          <CardTitle
            title="Attendance overview"
            subtitle="A little perspective on your team’s week"
            action={
              <span className="subtle-chip">
                Last 7 days <ChevronIcon />
              </span>
            }
          />
          <div className="chart-legend">
            <span>
              <i className="legend-purple" />
              In office
            </span>
            <span>
              <i className="legend-lavender" />
              Remote
            </span>
            <span>
              <i className="legend-gray" />
              Absent
            </span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={`Attendance over the last seven days. ${data.attendance_trend.map((day) => `${day.day}: ${day.present} office, ${day.remote} remote, ${day.absent} absent`).join(". ")}`}
          >
            <div className="chart-grid-lines">
              <span>{maxAttendance}</span>
              <span>{Math.round(maxAttendance * 0.75)}</span>
              <span>{Math.round(maxAttendance * 0.5)}</span>
              <span>{Math.round(maxAttendance * 0.25)}</span>
              <span>0</span>
            </div>
            <div className="chart-bars">
              {data.attendance_trend.map((day, index) => (
                <div className="chart-day" key={`${day.day}-${index}`}>
                  <div
                    className="stacked-bar"
                    title={`${day.present} in office · ${day.remote} remote · ${day.absent} absent`}
                  >
                    <span
                      className="bar-absent"
                      style={{ height: `${(day.absent / maxAttendance) * 100}%` }}
                    />
                    <span
                      className="bar-remote"
                      style={{ height: `${(day.remote / maxAttendance) * 100}%` }}
                    />
                    <span
                      className="bar-present"
                      style={{ height: `${(day.present / maxAttendance) * 100}%` }}
                    />
                  </div>
                  <span className="chart-day-label">{day.day}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-footer">
            <span>
              <span className="live-dot" />
              Live data from your attendance records
            </span>
            <TextLink onClick={() => navigate("/attendance")}>View attendance</TextLink>
          </div>
        </section>
        <section className="panel workforce-chart">
          <CardTitle title="One team. Many talents." subtitle="Your people by department" />
          <div className="donut-layout">
            <div
              className="donut-chart"
              style={{ background: departmentTotal ? `conic-gradient(${gradient})` : "#eeeaf4" }}
              role="img"
              aria-label={data.departments
                .map((department) => `${department.name}: ${department.count}`)
                .join(", ")}
            >
              <div>
                <strong>{departmentTotal}</strong>
                <span>team members</span>
              </div>
            </div>
            <div className="department-legend">
              {data.departments.map((department) => (
                <div key={department.name}>
                  <i style={{ background: department.color }} />
                  <span>{department.name}</span>
                  <strong>{department.count}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-footer">
            <span>Room for every kind of brilliance.</span>
            <ArrowDownRight size={18} />
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <CardTitle
            title="Fresh faces, fresh perspectives"
            subtitle="Say hello to your newest teammates"
            action={<TextLink onClick={() => navigate("/employees")}>All employees</TextLink>}
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_hires.slice(0, 4).map((employee) => (
                  <tr
                    key={employee.id}
                    className="clickable-row"
                    onClick={() => navigate(`/employees?profile=${employee.id}`)}
                  >
                    <td>
                      <div className="person-cell">
                        <Avatar name={employee.name} color={employee.avatar_color} />
                        <div>
                          <button
                            className="person-name"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/employees?profile=${employee.id}`);
                            }}
                          >
                            {employee.name}
                          </button>
                          <small>{employee.job_title}</small>
                        </div>
                      </div>
                    </td>
                    <td>{employee.department}</td>
                    <td>{formatDate(employee.join_date, true)}</td>
                    <td>
                      <Badge value={employee.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.recent_hires.length && <Empty title="Your team starts here" />}
          </div>
        </section>
        <section className="panel events-panel">
          <CardTitle
            title="On the horizon"
            subtitle="The moments that bring us together"
            action={<CalendarDays size={19} />}
          />
          {data.upcoming_events.slice(0, 3).map((event, index) => (
            <div className="event-row" key={`${event.title}-${index}`}>
              <div className={`event-date event-date-${index}`}>
                <small>
                  {new Date(`${event.date}T12:00:00`).toLocaleDateString("en", { month: "short" })}
                </small>
                <strong>{new Date(`${event.date}T12:00:00`).getDate()}</strong>
              </div>
              <div>
                <h3>{event.title}</h3>
                <p>{event.type.replace(/_/g, " ")}</p>
              </div>
            </div>
          ))}
          {!data.upcoming_events.length && (
            <Empty title="A little breathing room" message="No upcoming events." />
          )}
          <button className="events-link" onClick={() => navigate("/announcements")}>
            Catch up on company news <ArrowRight size={15} />
          </button>
        </section>
      </div>
      {news?.announcements[0] && (
        <div className="news-strip">
          <span className="news-icon">✳</span>
          <span className="news-label">THE LATEST</span>
          <p>
            <strong>{news.announcements[0].title}</strong>
            <span>{news.announcements[0].body.slice(0, 95)}…</span>
          </p>
          <button
            className="icon-button"
            aria-label="Read latest announcement"
            onClick={() => navigate("/announcements")}
          >
            <ArrowUpRight size={20} />
          </button>
        </div>
      )}
    </>
  );
}

function ChevronIcon() {
  return <span aria-hidden="true">⌄</span>;
}
