import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Archive,
  Building2,
  Download,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { api, formatDate, json, today, useAction, useApi } from "./api";
import type { CurrentUser, Directory, Employee } from "./types";
import { Avatar, Badge, Button, Empty, ErrorState, Loading, Modal, PageTitle } from "./ui";

export function Employees() {
  const query = useApi<Directory>("/hr/employees");
  const { data: current } = useApi<CurrentUser>("/hr/me");
  const [params, setParams] = useSearchParams();
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [layout, setLayout] = useState("grid");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [archive, setArchive] = useState<Employee | null>(null);
  const remove = useAction(
    (id: number) => api(`/hr/employees/${id}`, json("DELETE")),
    "Employee archived. Their records are preserved.",
  );
  const search = params.get("search") || "";
  const selected = query.data?.employees.find(
    (employee) => String(employee.id) === params.get("profile"),
  );
  const canManage = current?.user.role === "admin";

  function setParam(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const employees = query.data.employees.filter(
    (employee) =>
      (!department || employee.department === department) &&
      (!status || employee.status === status) &&
      `${employee.name} ${employee.email} ${employee.job_title} ${employee.employee_code}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  function exportDirectory() {
    const rows = [
      ["Employee ID", "Name", "Email", "Department", "Job title", "Location", "Status"],
      ...employees.map((employee) => [
        employee.employee_code,
        employee.name,
        employee.email,
        employee.department,
        employee.job_title,
        employee.location,
        employee.status,
      ]),
    ];
    // Neutralize formulas when opening user-authored cells in spreadsheet apps.
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${(/^[=+@-]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `vynix-employees-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageTitle
        eyebrow="THE PEOPLE BEHIND THE POSSIBILITIES"
        title="Your people, all together."
        description="Get to know your team. Help everyone do their best work."
        actions={
          <>
            <Button variant="secondary" onClick={exportDirectory}>
              <Download size={16} />
              Export
            </Button>
            {canManage && (
              <Button onClick={() => setParam("add", "true")}>
                <Plus size={17} />
                Add employee
              </Button>
            )}
          </>
        }
      />
      <div className="directory-summary">
        <div>
          <span className="directory-icon">
            <Users size={23} />
          </span>
          <div>
            <strong>{query.data.total} people</strong>
            <span>A whole lot of potential.</span>
          </div>
        </div>
        <div className="directory-summary-stat">
          <i className="live-dot" />
          <strong>
            {query.data.employees.filter((employee) => employee.status === "active").length}
          </strong>{" "}
          active team members
        </div>
        <div className="directory-summary-stat">
          <Building2 size={16} />
          <strong>{query.data.departments.length}</strong> departments
        </div>
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search employees"
            value={search}
            onChange={(event) => setParam("search", event.target.value)}
            placeholder="Search by name, role, or email…"
          />
        </div>
        <div className="toolbar-filters">
          <SlidersHorizontal size={17} />
          <select
            aria-label="Filter by department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="">All departments</option>
            {query.data.departments.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="inactive">Archived</option>
          </select>
          <div className="segmented-control">
            <button
              aria-label="Grid view"
              aria-pressed={layout === "grid"}
              className={layout === "grid" ? "selected" : ""}
              onClick={() => setLayout("grid")}
            >
              <LayoutGrid size={17} />
            </button>
            <button
              aria-label="List view"
              aria-pressed={layout === "list"}
              className={layout === "list" ? "selected" : ""}
              onClick={() => setLayout("list")}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="results-caption">
        Showing <strong>{employees.length}</strong> {employees.length === 1 ? "person" : "people"}
        <span>Good people. Great things ahead.</span>
      </div>
      {!employees.length ? (
        <section className="panel">
          <Empty
            title="No teammates found"
            message="Try a different name or adjust your filters."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setParam("search", "");
                  setDepartment("");
                  setStatus("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </section>
      ) : layout === "grid" ? (
        <div className="employee-grid">
          {employees.map((employee) => (
            <article className="employee-card" key={employee.id}>
              <div className="employee-card-top">
                <span className="employee-code">{employee.employee_code}</span>
                <Badge value={employee.status} />
              </div>
              <div className="employee-card-person">
                <Avatar name={employee.name} color={employee.avatar_color} size="large" />
                <h2>{employee.name}</h2>
                <p>{employee.job_title}</p>
                <span className="department-chip">{employee.department}</span>
              </div>
              <div className="employee-card-meta">
                <span>
                  <Mail size={14} />
                  {employee.email}
                </span>
                <span>
                  <MapPin size={14} />
                  {employee.location || "Location not set"}
                </span>
              </div>
              <div className="employee-card-bottom">
                <span>{employee.employment_type}</span>
                <button onClick={() => setParam("profile", String(employee.id))}>
                  View profile <span>↗</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Location</th>
                <th>Joined</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Profile</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={employee.name} color={employee.avatar_color} />
                      <div>
                        <button
                          className="person-name"
                          onClick={() => setParam("profile", String(employee.id))}
                        >
                          {employee.name}
                        </button>
                        <small>{employee.job_title}</small>
                      </div>
                    </div>
                  </td>
                  <td>{employee.department}</td>
                  <td>{employee.location}</td>
                  <td>{formatDate(employee.join_date, true)}</td>
                  <td>
                    <Badge value={employee.status} />
                  </td>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => setParam("profile", String(employee.id))}
                    >
                      View ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <Modal
        open={Boolean(selected)}
        onClose={() => setParam("profile", "")}
        title="Employee profile"
        description="A closer look at the person behind the work."
        wide
      >
        {selected && (
          <>
            <div className="profile-hero">
              <Avatar name={selected.name} color={selected.avatar_color} size="large" />
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {selected.job_title} · {selected.department}
                </p>
                <Badge value={selected.status} />
              </div>
            </div>
            <dl className="profile-details">
              {[
                ["Employee ID", selected.employee_code],
                ["Employment", selected.employment_type],
                ["Email", selected.email],
                ["Phone", selected.phone || "Not provided"],
                ["Location", selected.location],
                ["Reports to", selected.manager || "Not assigned"],
                ["Joined", formatDate(selected.join_date)],
                ["Department", selected.department],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {canManage && (
              <div className="modal-actions">
                <Button
                  variant="ghost"
                  disabled={selected.status === "inactive"}
                  onClick={() => {
                    setArchive(selected);
                    setParam("profile", "");
                  }}
                >
                  <Archive size={16} />
                  Archive employee
                </Button>
                <Button
                  onClick={() => {
                    setEditing(selected);
                    setParam("profile", "");
                  }}
                >
                  <Pencil size={16} />
                  Edit profile
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={params.get("add") === "true" || Boolean(editing)}
        onClose={() => {
          setParam("add", "");
          setEditing(null);
        }}
        title={editing ? "Edit employee" : "Make room for someone great."}
        description="Keep your people records clear, current, and connected."
        wide
      >
        {(params.get("add") === "true" || editing) && (
          <EmployeeForm
            employee={editing}
            departments={query.data.departments}
            onDone={() => {
              setParam("add", "");
              setEditing(null);
            }}
          />
        )}
      </Modal>
      <Modal
        open={Boolean(archive)}
        onClose={() => setArchive(null)}
        title="Archive this employee?"
        description={`${archive?.name || "This employee"} will be marked inactive. Their attendance and leave history will remain available.`}
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setArchive(null)}>
            Keep employee
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              if (archive) remove.mutate(archive.id, { onSuccess: () => setArchive(null) });
            }}
          >
            {remove.isPending ? "Archiving…" : "Archive employee"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function EmployeeForm({
  employee,
  departments,
  onDone,
}: {
  employee: Employee | null;
  departments: string[];
  onDone: () => void;
}) {
  const save = useAction(
    (data: Record<string, string>) =>
      api(
        employee ? `/hr/employees/${employee.id}` : "/hr/employees",
        json(employee ? "PATCH" : "POST", data),
      ),
    employee ? "Employee profile updated" : "Your new teammate has been added",
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>, {
      onSuccess: onDone,
    });
  }
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          First name
          <input
            name="first_name"
            required
            maxLength={60}
            defaultValue={employee?.first_name}
            placeholder="e.g. Aarav"
          />
        </label>
        <label className="field">
          Last name
          <input
            name="last_name"
            required
            maxLength={60}
            defaultValue={employee?.last_name}
            placeholder="e.g. Sharma"
          />
        </label>
        <label className="field">
          Work email
          <input
            name="email"
            type="email"
            required
            defaultValue={employee?.email}
            placeholder="name@vynixhr.local"
          />
        </label>
        <label className="field">
          <span>
            <Phone size={12} /> Phone
          </span>
          <input
            name="phone"
            type="tel"
            defaultValue={employee?.phone}
            placeholder="+91 98765 43210"
          />
        </label>
        <label className="field">
          Department
          <input
            name="department"
            required
            list="departments"
            defaultValue={employee?.department}
            placeholder="Choose or enter department"
          />
          <datalist id="departments">
            {departments.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </datalist>
        </label>
        <label className="field">
          Job title
          <input
            name="job_title"
            required
            defaultValue={employee?.job_title}
            placeholder="e.g. Product Designer"
          />
        </label>
        <label className="field">
          Employment type
          <select name="employment_type" defaultValue={employee?.employment_type || "Full-time"}>
            {["Full-time", "Part-time", "Contract", "Intern"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Status
          <select name="status" defaultValue={employee?.status || "active"}>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="inactive">Archived</option>
          </select>
        </label>
        <label className="field">
          Joining date
          <input
            name="join_date"
            type="date"
            required
            defaultValue={employee?.join_date || today()}
          />
        </label>
        <label className="field">
          Location
          <input
            name="location"
            defaultValue={employee?.location}
            placeholder="e.g. Bengaluru, India"
          />
        </label>
        <label className="field full-width">
          Reports to
          <input name="manager" defaultValue={employee?.manager} placeholder="Manager’s name" />
        </label>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={save.isPending} type="submit">
          {save.isPending ? "Saving…" : employee ? "Save changes" : "Add employee"}
        </Button>
      </div>
    </form>
  );
}
