import { useState, type FormEvent } from "react";
import { Building2, Clock3, Save, ShieldCheck, UserRound } from "lucide-react";
import { api, json, useAction, useApi } from "./api";
import type { CurrentUser, Settings as CompanySettings } from "./types";
import { Avatar, Button, CardTitle, ErrorState, Loading, PageTitle } from "./ui";

export function Settings() {
  const [tab, setTab] = useState("company");
  const query = useApi<{ settings: CompanySettings }>("/hr/settings");
  const user = useApi<CurrentUser>("/hr/me");
  const save = useAction(
    (data: Record<string, unknown>) =>
      api(tab === "profile" ? "/hr/profile" : "/hr/settings", json("PATCH", data)),
    "Your changes have been saved",
  );
  if (query.isPending || user.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  if (user.error) return <ErrorState error={user.error} retry={() => void user.refetch()} />;
  const canManage = user.data.user.role === "admin";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data: Record<string, unknown> = Object.fromEntries(new FormData(event.currentTarget));
    if (tab === "company") {
      data.annual_leave_days = Number(data.annual_leave_days);
      data.sick_leave_days = Number(data.sick_leave_days);
    }
    save.mutate(data);
  }

  return (
    <>
      <PageTitle
        eyebrow="MAKE YOURSELF AT HOME"
        title="A workspace that works for you."
        description="A few thoughtful details make everything run a little smoother."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <button className={tab === "company" ? "active" : ""} onClick={() => setTab("company")}>
            <Building2 size={18} />
            Organization
          </button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
            <UserRound size={18} />
            My profile
          </button>
          <div className="settings-callout">
            <ShieldCheck size={21} />
            <strong>Your local workspace</strong>
            <p>
              Changes are saved to your own database. Demo policies can be customized for your team.
            </p>
          </div>
        </nav>
        <section className="panel settings-panel">
          <CardTitle
            title={tab === "company" ? "Organization details" : "A little about you"}
            subtitle={
              tab === "company"
                ? "The foundations of your everyday workspace."
                : "Keep your account details up to date."
            }
          />
          <form key={tab} onSubmit={submit}>
            {tab === "company" ? (
              <>
                <fieldset disabled={!canManage || save.isPending}>
                  <div className="form-grid">
                    <label className="field">
                      Organization name
                      <input
                        name="company_name"
                        required
                        defaultValue={query.data.settings.company_name}
                      />
                    </label>
                    <label className="field">
                      Contact email
                      <input
                        name="company_email"
                        type="email"
                        required
                        defaultValue={query.data.settings.company_email}
                      />
                    </label>
                    <label className="field">
                      Office location
                      <input name="location" required defaultValue={query.data.settings.location} />
                    </label>
                    <label className="field">
                      Timezone
                      <input
                        name="timezone"
                        required
                        defaultValue={query.data.settings.timezone}
                        placeholder="Asia/Kolkata"
                      />
                    </label>
                  </div>
                  <div className="form-section-title">
                    <Clock3 size={17} />
                    <h3>The rhythm of your workday</h3>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      Work starts
                      <input
                        name="work_start"
                        type="time"
                        required
                        defaultValue={query.data.settings.work_start}
                      />
                    </label>
                    <label className="field">
                      Work ends
                      <input
                        name="work_end"
                        type="time"
                        required
                        defaultValue={query.data.settings.work_end}
                      />
                    </label>
                    <label className="field">
                      Annual leave allowance
                      <input
                        name="annual_leave_days"
                        type="number"
                        min="0"
                        max="365"
                        required
                        defaultValue={query.data.settings.annual_leave_days}
                      />
                    </label>
                    <label className="field">
                      Sick leave allowance
                      <input
                        name="sick_leave_days"
                        type="number"
                        min="0"
                        max="365"
                        required
                        defaultValue={query.data.settings.sick_leave_days}
                      />
                    </label>
                  </div>
                </fieldset>
                <p className="form-note">
                  These settings describe your workspace. Update and retrain the FAQ dataset
                  separately when handbook policies change.
                </p>
              </>
            ) : (
              <>
                <div className="profile-settings-header">
                  <Avatar name={user.data.user.name} size="large" />
                  <span>
                    <strong>{user.data.user.name}</strong>
                    <small>
                      {user.data.user.role === "admin" ? "Workspace administrator" : "Team member"}
                    </small>
                  </span>
                </div>
                <div className="form-grid">
                  <label className="field">
                    Full name
                    <input name="name" required defaultValue={user.data.user.name} />
                  </label>
                  <label className="field">
                    Email address
                    <input name="email" type="email" required defaultValue={user.data.user.email} />
                  </label>
                </div>
                <p className="form-note">
                  Changing your email updates the address you use to sign in.
                </p>
              </>
            )}
            {(canManage || tab === "profile") && (
              <div className="modal-actions">
                <Button disabled={save.isPending}>
                  <Save size={16} />
                  {save.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </form>
        </section>
      </div>
    </>
  );
}
