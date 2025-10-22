import { useState, type FormEvent } from "react";
import { CalendarDays, Check, Coffee, Plus, X } from "lucide-react";
import { api, formatDate, json, today, useAction, useApi } from "./api";
import type { CurrentUser, Directory, Leave } from "./types";
import { Avatar, Badge, Button, Empty, ErrorState, Loading, Modal, PageTitle } from "./ui";

export function Leaves() {
  const query = useApi<{ leaves: Leave[] }>("/hr/leaves");
  const { data: directory } = useApi<Directory>("/hr/employees");
  const { data: current } = useApi<CurrentUser>("/hr/me");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(today());
  const [detail, setDetail] = useState<Leave | null>(null);
  const save = useAction(
    (data: Record<string, unknown>) => api("/hr/leaves", json("POST", data)),
    "Time-off request submitted",
  );
  const review = useAction(
    ({ id, status }: { id: number; status: string }) =>
      api(`/hr/leaves/${id}`, json("PATCH", { status })),
    "Time-off request updated",
  );
  const canManage = current?.user.role === "admin";
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const leaves = query.data.leaves.filter((leave) => filter === "all" || leave.status === filter);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    save.mutate(
      { ...values, employee_id: Number(values.employee_id) },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <PageTitle
        eyebrow="SPACE TO REST. ROOM TO RECHARGE."
        title="Good work needs a little time off."
        description="Plan time away and keep your team in the loop."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            Request time off
          </Button>
        }
      />
      <div className="leave-banner">
        <div className="leave-banner-icon">
          <Coffee size={30} />
        </div>
        <div>
          <h2>Rest is part of doing great work.</h2>
          <p>Manage requests with clarity, so your people can switch off with peace of mind.</p>
        </div>
        <span>
          {query.data.leaves.filter((leave) => leave.status === "pending").length}
          <small>awaiting review</small>
        </span>
      </div>
      <section className="panel">
        <div className="filter-tabs">
          {["all", "pending", "approved", "rejected"].map((status) => (
            <button
              key={status}
              className={filter === status ? "active" : ""}
              onClick={() => setFilter(status)}
            >
              {status === "all" ? "All requests" : status}
              <span>
                {
                  query.data.leaves.filter((leave) => status === "all" || leave.status === status)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={leave.employee_name} />
                      <div>
                        <strong>{leave.employee_name}</strong>
                        <small>{leave.department}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="leave-type">
                      <CalendarDays size={15} />
                      {leave.type}
                    </span>
                  </td>
                  <td>
                    {formatDate(leave.start_date, true)} – {formatDate(leave.end_date, true)}
                  </td>
                  <td>{leave.days}</td>
                  <td>
                    <Badge value={leave.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="text-link" onClick={() => setDetail(leave)}>
                        Details
                      </button>
                      {canManage && leave.status === "pending" && (
                        <>
                          <button
                            className="approve-button"
                            disabled={review.isPending}
                            aria-label={`Approve ${leave.employee_name}'s leave`}
                            onClick={() => review.mutate({ id: leave.id, status: "approved" })}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            className="reject-button"
                            disabled={review.isPending}
                            aria-label={`Reject ${leave.employee_name}'s leave`}
                            onClick={() => review.mutate({ id: leave.id, status: "rejected" })}
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!leaves.length && (
          <Empty
            title="All clear here"
            message={`There are no ${filter === "all" ? "time-off" : filter} requests to show.`}
          />
        )}
      </section>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="A little time for yourself."
        description="Submit a request for review by your workspace admin."
      >
        <form onSubmit={submit}>
          <label className="field">
            Employee
            <select name="employee_id" required defaultValue={current?.user.employee_id || ""}>
              <option value="" disabled>
                Choose a teammate
              </option>
              {directory?.employees
                .filter(
                  (employee) =>
                    employee.status !== "inactive" &&
                    (canManage || employee.id === current?.user.employee_id),
                )
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Leave type
            <select name="type">
              {["Annual", "Sick", "Casual", "Parental", "Unpaid"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label className="field">
              From
              <input
                type="date"
                name="start_date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </label>
            <label className="field">
              Until
              <input type="date" name="end_date" min={startDate} defaultValue={today()} required />
            </label>
          </div>
          <label className="field">
            Reason
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={1000}
              rows={3}
              placeholder="Help your manager plan around your time away…"
            />
          </label>
          <p className="form-note">Leave duration uses calendar days, including weekends.</p>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending}>
              {save.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Time-off request"
        description={detail ? `${detail.employee_name} · ${detail.department}` : ""}
      >
        {detail && (
          <>
            <dl className="profile-details">
              <div>
                <dt>Type</dt>
                <dd>{detail.type}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge value={detail.status} />
                </dd>
              </div>
              <div>
                <dt>From</dt>
                <dd>{formatDate(detail.start_date)}</dd>
              </div>
              <div>
                <dt>Until</dt>
                <dd>{formatDate(detail.end_date)}</dd>
              </div>
            </dl>
            <div className="reason-card">
              <small>REASON FOR REQUEST</small>
              <p>{detail.reason}</p>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
