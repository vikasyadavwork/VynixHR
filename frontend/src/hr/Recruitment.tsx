import { useState, type FormEvent } from "react";
import { ArrowUpRight, BriefcaseBusiness, MapPin, Plus, Users } from "lucide-react";
import { api, json, useAction, useApi } from "./api";
import type { Applicant, CurrentUser, Directory, Job } from "./types";
import {
  Avatar,
  Badge,
  Button,
  CardTitle,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageTitle,
} from "./ui";

export function Recruitment() {
  const query = useApi<{ jobs: Job[]; applicants: Applicant[] }>("/hr/jobs");
  const { data: directory } = useApi<Directory>("/hr/employees");
  const { data: current } = useApi<CurrentUser>("/hr/me");
  const [modal, setModal] = useState<"job" | "applicant" | null>(null);
  const [jobFilter, setJobFilter] = useState("");
  const [selected, setSelected] = useState<Job | null>(null);
  const [stageFilter, setStageFilter] = useState("");
  const create = useAction(
    (data: Record<string, unknown>) =>
      api(modal === "job" ? "/hr/jobs" : "/hr/applicants", json("POST", data)),
    modal === "job" ? "Your open role is ready" : "Candidate added to the pipeline",
  );
  const updateStage = useAction(
    ({ id, stage }: { id: number; stage: string }) =>
      api(`/hr/applicants/${id}`, json("PATCH", { stage })),
    "Candidate stage updated",
  );
  const updateJob = useAction(
    ({ id, status }: { id: number; status: string }) =>
      api(`/hr/jobs/${id}`, json("PATCH", { status })),
    "Job status updated",
  );
  const canManage = current?.user.role === "admin";
  const stages = ["applied", "screening", "interview", "offer", "hired", "rejected"];
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const { jobs, applicants } = query.data;
  const filtered = applicants.filter(
    (applicant) =>
      (!jobFilter || String(applicant.job_id) === jobFilter) &&
      (!stageFilter || applicant.stage === stageFilter),
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    create.mutate(
      modal === "job"
        ? values
        : {
            ...values,
            job_id: Number(values.job_id),
            experience_years: Number(values.experience_years),
          },
      { onSuccess: () => setModal(null) },
    );
  }

  return (
    <>
      <PageTitle
        eyebrow="MAKE YOUR NEXT GREAT CONNECTION"
        title="The right people. A shared future."
        description="Keep every opportunity and candidate moving forward."
        actions={
          canManage && (
            <>
              <Button variant="secondary" onClick={() => setModal("applicant")}>
                <Users size={16} />
                Add candidate
              </Button>
              <Button onClick={() => setModal("job")}>
                <Plus size={17} />
                Create job
              </Button>
            </>
          )
        }
      />
      <div className="section-caption">
        <h2>
          Open doors <span>{jobs.filter((job) => job.status === "open").length} open roles</span>
        </h2>
        <span>Build a team that moves you forward.</span>
      </div>
      <div className="job-grid">
        {jobs.map((job) => (
          <article key={job.id} className="job-card">
            <div className="job-top">
              <span className="job-icon">
                <BriefcaseBusiness size={21} />
              </span>
              <Badge value={job.status} />
            </div>
            <span className="job-department">{job.department}</span>
            <h2>{job.title}</h2>
            <div className="job-meta">
              <span>
                <MapPin size={14} />
                {job.location}
              </span>
              <span>{job.employment_type}</span>
            </div>
            <div className="job-bottom">
              <span>
                <Users size={16} />
                <strong>{job.applicants_count}</strong> candidates
              </span>
              <button
                className="icon-button"
                aria-label={`View ${job.title}`}
                onClick={() => setSelected(job)}
              >
                <ArrowUpRight size={19} />
              </button>
            </div>
            <button
              className="job-pipeline-link"
              onClick={() => {
                setJobFilter(String(job.id));
                document
                  .getElementById("candidates")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              View candidate pipeline →
            </button>
          </article>
        ))}
      </div>
      {!jobs.length && (
        <section className="panel">
          <Empty
            title="The next chapter starts with a role"
            message="Create your first job opening to start building a candidate pipeline."
          />
        </section>
      )}
      <section className="panel candidates-panel" id="candidates">
        <CardTitle
          title="Your talent pipeline"
          subtitle="Keep the conversation moving, one candidate at a time."
        />
        <div className="pipeline-summary">
          {stages.slice(0, 5).map((stage, index) => (
            <button
              key={stage}
              className={stageFilter === stage ? "selected" : ""}
              onClick={() => setStageFilter(stageFilter === stage ? "" : stage)}
            >
              <span className={`pipeline-step step-${index}`}>
                {
                  applicants.filter(
                    (applicant) =>
                      applicant.stage === stage &&
                      (!jobFilter || String(applicant.job_id) === jobFilter),
                  ).length
                }
              </span>
              <span>{stage}</span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <select
            aria-label="Filter candidates by job"
            value={jobFilter}
            onChange={(event) => setJobFilter(event.target.value)}
          >
            <option value="">All roles</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter candidates by stage"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
          >
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
          <span className="muted-small">{filtered.length} candidates</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role</th>
                <th>Experience</th>
                <th>Stage</th>
                {canManage && <th>Move to</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((applicant) => (
                <tr key={applicant.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={applicant.name} color={applicant.avatar_color} />
                      <div>
                        <strong>{applicant.name}</strong>
                        <small>{applicant.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{applicant.job_title}</td>
                  <td>{applicant.experience_years} years</td>
                  <td>
                    <Badge value={applicant.stage} />
                  </td>
                  {canManage && (
                    <td>
                      <select
                        className="table-select"
                        aria-label={`Stage for ${applicant.name}`}
                        value={applicant.stage}
                        disabled={updateStage.isPending}
                        onChange={(event) =>
                          updateStage.mutate({ id: applicant.id, stage: event.target.value })
                        }
                      >
                        {stages.map((stage) => (
                          <option key={stage}>{stage}</option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty
            title="No candidates at this stage"
            message="Add a candidate or try another filter."
          />
        )}
      </section>
      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal === "job" ? "Open a door to new talent." : "Meet your next possibility."}
        description={
          modal === "job"
            ? "Create an internal opening to organize your hiring pipeline."
            : "Add a candidate to a role and follow their progress."
        }
      >
        <form onSubmit={submit}>
          {modal === "job" ? (
            <>
              <label className="field">
                Job title
                <input name="title" required placeholder="e.g. Senior Product Designer" />
              </label>
              <div className="form-grid">
                <label className="field">
                  Department
                  <input name="department" required list="job-departments" placeholder="Design" />
                  <datalist id="job-departments">
                    {directory?.departments.map((department) => (
                      <option key={department}>{department}</option>
                    ))}
                  </datalist>
                </label>
                <label className="field">
                  Location
                  <input name="location" required placeholder="Bengaluru / Remote" />
                </label>
              </div>
              <label className="field">
                Employment type
                <select name="employment_type">
                  {["Full-time", "Part-time", "Contract", "Intern"].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Role description
                <textarea
                  name="description"
                  rows={4}
                  placeholder="What will this person help your team achieve?"
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                Full name
                <input name="name" required placeholder="Candidate’s name" />
              </label>
              <label className="field">
                Email
                <input name="email" type="email" required placeholder="candidate@example.com" />
              </label>
              <label className="field">
                Applying for
                <select name="job_id" required defaultValue={jobFilter || ""}>
                  <option value="" disabled>
                    Select an open role
                  </option>
                  {jobs
                    .filter((job) => job.status === "open")
                    .map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Years of experience
                <input
                  name="experience_years"
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  defaultValue="0"
                />
              </label>
            </>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button disabled={create.isPending}>
              {create.isPending ? "Saving…" : modal === "job" ? "Create job" : "Add candidate"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title || "Job details"}
        description={
          selected
            ? `${selected.department} · ${selected.location} · ${selected.employment_type}`
            : ""
        }
      >
        {selected && (
          <>
            <Badge value={jobs.find((job) => job.id === selected.id)?.status || selected.status} />
            <div className="job-description">
              {selected.description || "No description has been added for this role."}
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Close
              </Button>
              {canManage && (
                <Button
                  disabled={updateJob.isPending}
                  onClick={() => {
                    const status = jobs.find((job) => job.id === selected.id)?.status;
                    updateJob.mutate(
                      { id: selected.id, status: status === "open" ? "closed" : "open" },
                      { onSuccess: () => setSelected(null) },
                    );
                  }}
                >
                  {selected.status === "open" ? "Close this role" : "Reopen this role"}
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
