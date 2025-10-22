import { useState, type FormEvent } from "react";
import { CheckSquare2, Pencil, Plus, Trash2 } from "lucide-react";
import { api, json, useAction, useApi } from "./api";
import type { Tag, Task } from "@/types/types";
import { Badge, Button, Empty, ErrorState, Loading, Modal, PageTitle } from "./ui";

export function Tasks() {
  const query = useApi<Task[]>("/tasks/user");
  const { data: tags } = useApi<Tag[]>("/tags");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Task | null>(null);
  const [remove, setRemove] = useState<Task | null>(null);
  const [filter, setFilter] = useState("all");
  const save = useAction(
    (data: Record<string, unknown>) =>
      api(edit ? `/tasks/${edit.id}` : "/tasks", json(edit ? "PUT" : "POST", data)),
    edit ? "Task updated" : "Task created",
  );
  const deleteTask = useAction((id: number) => api(`/tasks/${id}`, json("DELETE")), "Task deleted");
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const statuses = ["PENDING", "IN_PROGRESS", "COMPLETED"];
  const tasks = query.data.filter((task) => filter === "all" || task.status.endsWith(filter));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    save.mutate(values, {
      onSuccess: () => {
        setOpen(false);
        setEdit(null);
      },
    });
  }

  return (
    <>
      <PageTitle
        eyebrow="SMALL STEPS. MEANINGFUL PROGRESS."
        title="Make space for your best work."
        description="Keep your personal tasks organized, from to-do to done."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            Create task
          </Button>
        }
      />
      <div className="filter-tabs standalone-tabs">
        {["all", ...statuses].map((status) => (
          <button
            className={filter === status ? "active" : ""}
            key={status}
            onClick={() => setFilter(status)}
          >
            {status === "all" ? "All tasks" : status.toLowerCase().replace(/_/g, " ")}
          </button>
        ))}
      </div>
      <div className="task-grid">
        {tasks.map((task) => (
          <article className="task-card" key={task.id}>
            <div className="task-top">
              <span className="task-icon">
                <CheckSquare2 size={20} />
              </span>
              <Badge value={task.status.replace("TaskStatus.", "").toLowerCase()} />
            </div>
            <h2>{task.title}</h2>
            <p>{task.content}</p>
            <div className="task-bottom">
              <span className="department-chip">{task.tagName}</span>
              <div>
                <button
                  className="icon-button"
                  aria-label={`Edit ${task.title}`}
                  onClick={() => {
                    setEdit(task);
                    setOpen(true);
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => setRemove(task)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!tasks.length && (
        <section className="panel">
          <Empty
            title="A fresh start"
            message="Add a task and take the first step toward a productive day."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus size={16} />
                Create a task
              </Button>
            }
          />
        </section>
      )}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEdit(null);
        }}
        title={edit ? "Fine-tune your task." : "One step closer."}
        description="Capture what needs doing and keep things moving."
      >
        <form onSubmit={submit}>
          <label className="field">
            Title
            <input
              name="title"
              maxLength={40}
              required
              defaultValue={edit?.title}
              placeholder="What needs to happen?"
            />
          </label>
          <label className="field">
            Description
            <textarea
              name="content"
              maxLength={600}
              required
              defaultValue={edit?.content}
              rows={4}
              placeholder="A few useful details…"
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Status
              <select
                name="status"
                defaultValue={edit?.status.replace("TaskStatus.", "") || "PENDING"}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.toLowerCase().replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            {!edit && (
              <label className="field">
                Category
                <select name="tagId" required defaultValue="">
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {tags?.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setEdit(null);
              }}
            >
              Cancel
            </Button>
            <Button disabled={save.isPending}>{save.isPending ? "Saving…" : "Save task"}</Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        title="Delete this task?"
        description={`“${remove?.title || "This task"}” will be permanently removed.`}
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setRemove(null)}>
            Keep task
          </Button>
          <Button
            variant="danger"
            disabled={deleteTask.isPending}
            onClick={() => {
              if (remove) deleteTask.mutate(remove.id, { onSuccess: () => setRemove(null) });
            }}
          >
            Delete task
          </Button>
        </div>
      </Modal>
    </>
  );
}
