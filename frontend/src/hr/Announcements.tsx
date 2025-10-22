import { useState, type FormEvent } from "react";
import { Bell, Pin, Plus } from "lucide-react";
import { api, formatDate, json, useAction, useApi } from "./api";
import type { Announcement, CurrentUser } from "./types";
import { Avatar, Button, Empty, ErrorState, Loading, Modal, PageTitle } from "./ui";

export function Announcements() {
  const query = useApi<{ announcements: Announcement[] }>("/hr/announcements");
  const { data: current } = useApi<CurrentUser>("/hr/me");
  const [category, setCategory] = useState("All");
  const [open, setOpen] = useState(false);
  const save = useAction(
    (data: Record<string, unknown>) => api("/hr/announcements", json("POST", data)),
    "Announcement published to your workspace",
  );
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const filtered = query.data.announcements.filter(
    (item) => category === "All" || item.category === category,
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    save.mutate({ ...values, pinned: values.pinned === "on" }, { onSuccess: () => setOpen(false) });
  }

  return (
    <>
      <PageTitle
        eyebrow="KEEP THE WHOLE TEAM IN THE LOOP"
        title="The good things, shared."
        description="Company updates, team milestones, and the moments that matter."
        actions={
          current?.user.role === "admin" && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={17} />
              New announcement
            </Button>
          )
        }
      />
      <div className="announcement-intro">
        <span>
          <Bell size={26} />
        </span>
        <div>
          <h2>A little more connected.</h2>
          <p>Your front-row seat to what’s happening across Vynix.</p>
        </div>
        <span className="announcement-count">{query.data.announcements.length} updates</span>
      </div>
      <div className="filter-tabs standalone-tabs">
        {["All", "Company", "People", "Policy", "Event"].map((item) => (
          <button
            key={item}
            className={item === category ? "active" : ""}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="announcement-grid">
        {filtered.map((item) => (
          <article
            className={`announcement-card announcement-${item.category.toLowerCase()}`}
            key={item.id}
          >
            <div className="announcement-top">
              <span className="department-chip">{item.category}</span>
              {item.pinned && (
                <span className="pinned-label">
                  <Pin size={13} />
                  Pinned
                </span>
              )}
            </div>
            <h2>{item.title}</h2>
            <p className="announcement-body">{item.body}</p>
            <div className="announcement-author">
              <Avatar name={item.author} size="small" />
              <span>
                <strong>{item.author}</strong>
                <small>{formatDate(item.published_at)}</small>
              </span>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <section className="panel">
          <Empty
            title="No updates here just yet"
            message="Check another category or share an announcement with your team."
          />
        </section>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Something worth sharing?"
        description="Publish an update to your local workspace announcement board."
      >
        <form onSubmit={submit}>
          <label className="field">
            Title
            <input
              name="title"
              required
              maxLength={180}
              placeholder="Give your update a clear headline"
            />
          </label>
          <label className="field">
            Category
            <select name="category">
              {["Company", "People", "Policy", "Event"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Your update
            <textarea
              name="body"
              required
              rows={5}
              maxLength={5000}
              placeholder="What would you like your team to know?"
            />
          </label>
          <label className="checkbox-field">
            <input type="checkbox" name="pinned" />
            Pin this update to the top
          </label>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending}>
              {save.isPending ? "Publishing…" : "Publish update"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
