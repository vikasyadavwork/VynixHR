import { useState, type FormEvent } from "react";
import { CalendarDays, Check, Clock3, Home, LogIn, LogOut, Search, Users } from "lucide-react";
import { api, formatDate, json, useAction, useApi } from "./api";
import type { AttendanceData, CurrentUser, Directory } from "./types";
import { Avatar, Badge, Button, Empty, ErrorState, Loading, Modal, PageTitle } from "./ui";

export function Attendance() {
  // Let the API choose today using the workspace timezone, not the browser clock.
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<"check-in" | "check-out" | null>(null);
  const query = useApi<AttendanceData>(date ? `/hr/attendance?date=${date}` : "/hr/attendance");
  const { data: directory } = useApi<Directory>("/hr/employees");
  const { data: current } = useApi<CurrentUser>("/hr/me");
  const save = useAction(
    (data: Record<string, unknown>) => api(`/hr/attendance/${action}`, json("POST", data)),
    action === "check-in" ? "Check-in recorded" : "Check-out recorded",
  );
  const activeEmployees =
    directory?.employees.filter(
      (employee) =>
        employee.status !== "inactive" &&
        (current?.user.role === "admin" || employee.id === current?.user.employee_id),
    ) || [];
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const rows = query.data.attendance.filter((row) =>
    `${row.employee_name} ${row.department}`.toLowerCase().includes(search.toLowerCase()),
  );
  const stats = [
    { title: "In the office", value: query.data.summary.present, icon: Users, color: "purple" },
    { title: "Working remotely", value: query.data.summary.remote, icon: Home, color: "blue" },
    { title: "Not checked in", value: query.data.summary.absent, icon: Clock3, color: "orange" },
    {
      title: "Taking time off",
      value: query.data.summary.on_leave,
      icon: CalendarDays,
      color: "green",
    },
  ];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    save.mutate(
      { ...values, employee_id: Number(values.employee_id) },
      {
        onSuccess: () => {
          setAction(null);
          setDate("");
        },
      },
    );
  }

  return (
    <>
      <PageTitle
        eyebrow="EVERY WORKDAY, ACCOUNTED FOR"
        title="A pulse on your workday."
        description="A clear view of who’s here, wherever here happens to be."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAction("check-out")}>
              <LogOut size={17} />
              Check out
            </Button>
            <Button onClick={() => setAction("check-in")}>
              <LogIn size={17} />
              Check in
            </Button>
          </>
        }
      />
      <div className="metrics-grid">
        {stats.map(({ title, value, icon: Icon, color }) => (
          <div className="metric-card" key={title}>
            <div className="metric-top">
              <span>{title}</span>
              <span className={`metric-icon ${color}`}>
                <Icon size={20} />
              </span>
            </div>
            <strong className="metric-value">{value}</strong>
            <div className="metric-detail">People · {formatDate(query.data.date, true)}</div>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="card-heading">
          <div>
            <h2>Attendance log</h2>
            <p>Check-in and check-out records for your team</p>
          </div>
          <label className="date-picker">
            <CalendarDays size={16} />
            <input
              type="date"
              value={query.data.date}
              onChange={(event) => {
                if (event.target.value) setDate(event.target.value);
              }}
              aria-label="Attendance date"
            />
          </label>
        </div>
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search attendance"
              placeholder="Find a teammate…"
            />
          </div>
          <span className="muted-small">{rows.length} records</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Hours worked</th>
                <th>Work mode</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee_id}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={row.employee_name} />
                      <div>
                        <strong>{row.employee_name}</strong>
                        <small>{row.department}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge value={row.status} />
                  </td>
                  <td>{row.check_in || "—"}</td>
                  <td>{row.check_out || "—"}</td>
                  <td>{row.hours ? `${row.hours.toFixed(1)} hrs` : "—"}</td>
                  <td>
                    <span className="work-mode">
                      {row.work_mode === "remote" ? <Home size={14} /> : <Users size={14} />}
                      {row.work_mode || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="No attendance records"
            message="Try another date or record a check-in for today."
          />
        )}
        <div className="table-footer">
          <Check size={14} />
          Times follow the workspace timezone. Check-ins always apply to today.
        </div>
      </section>
      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action === "check-in" ? "Let’s start a good workday." : "That’s a wrap for today."}
        description={`Record a ${action} for today in the workspace timezone.`}
      >
        <form onSubmit={submit}>
          <label className="field">
            Employee
            <select name="employee_id" required defaultValue={current?.user.employee_id || ""}>
              <option value="" disabled>
                Choose a teammate
              </option>
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          {action === "check-in" && (
            <label className="field">
              Working from
              <select name="work_mode">
                <option value="office">The office</option>
                <option value="remote">Remote</option>
              </select>
            </label>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending || !activeEmployees.length}>
              {save.isPending
                ? "Recording…"
                : action === "check-in"
                  ? "Confirm check-in"
                  : "Confirm check-out"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
