"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TaskStatus = "not_started" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  listId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
};

type TasksResponse = {
  data?: Task[];
  error?: { message?: string };
};

type SingleTaskResponse = {
  data?: Task;
  error?: { message?: string };
};

type DeleteResponse = {
  data?: { id: string };
  error?: { message?: string };
};

type Props = {
  lists: Array<{ id: string; title: string }>;
  categories: Array<{ id: string; name: string }>;
  canAccessAdmin: boolean;
};

export function TasksPageClient({ lists, categories, canAccessAdmin }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");

  useEffect(() => {
    if (!listId && lists.length > 0) {
      setListId(lists[0].id);
    }
  }, [lists, listId]);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/tasks", { method: "GET" });
      const payload = (await response.json()) as TasksResponse;

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to fetch tasks");
      }

      setTasks(payload.data ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const totalEstimatedMinutes = useMemo(
    () => tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
    [tasks],
  );

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!listId) {
      toast.error("Choose a list before creating a task.");
      return;
    }

    if (!title.trim()) {
      toast.error("Task title is required.");
      return;
    }

    const estimated = Number.parseInt(estimatedMinutes, 10);
    if (Number.isNaN(estimated) || estimated < 1) {
      toast.error("Estimated minutes must be a positive number.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() ? description.trim() : null,
          listId,
          categoryId: categoryId || null,
          priority,
          estimatedMinutes: estimated,
        }),
      });

      const payload = (await response.json()) as SingleTaskResponse;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Failed to create task");
      }

      setTasks((current) => [payload.data as Task, ...current]);
      setTitle("");
      setDescription("");
      setCategoryId("");
      setPriority("medium");
      setEstimatedMinutes("30");
      toast.success("Task created.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    setActiveTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          completedAt: status === "done" ? new Date().toISOString() : null,
        }),
      });

      const payload = (await response.json()) as SingleTaskResponse;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Failed to update task");
      }

      setTasks((current) =>
        current.map((task) => (task.id === taskId ? (payload.data as Task) : task)),
      );
      toast.success("Task updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message);
    } finally {
      setActiveTaskId(null);
    }
  }

  async function deleteTask(taskId: string) {
    setActiveTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as DeleteResponse;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Failed to delete task");
      }

      setTasks((current) => current.filter((task) => task.id !== taskId));
      toast.success("Task deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message);
    } finally {
      setActiveTaskId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            Create tasks and manage their status through the protected API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="border-input bg-input/20 hover:bg-input/50 inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium"
            >
              Home
            </Link>
            {canAccessAdmin ? (
              <Link
                href="/admin"
                className="border-input bg-input/20 hover:bg-input/50 inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium"
              >
                Admin
              </Link>
            ) : null}
            <Button variant="outline" onClick={() => void fetchTasks()}>
              Refresh
            </Button>
            <span className="text-muted-foreground text-xs">
              Total estimate: {totalEstimatedMinutes} min
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Task</CardTitle>
          <CardDescription>POST /api/tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {lists.length === 0 ? (
            <p className="text-destructive text-xs">
              You have no todo lists yet. Create at least one list in the
              database before adding tasks.
            </p>
          ) : (
            <form onSubmit={createTask} className="grid gap-3">
              <Input
                placeholder="Task title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={255}
                required
              />
              <Textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={5000}
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-xs">
                  <span className="text-muted-foreground mb-1 block">
                    List
                  </span>
                  <select
                    className="bg-input/20 border-input h-7 w-full rounded-md border px-2 text-xs"
                    value={listId}
                    onChange={(event) => setListId(event.target.value)}
                    required
                  >
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="text-muted-foreground mb-1 block">
                    Category
                  </span>
                  <select
                    className="bg-input/20 border-input h-7 w-full rounded-md border px-2 text-xs"
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                  >
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="text-muted-foreground mb-1 block">
                    Priority
                  </span>
                  <select
                    className="bg-input/20 border-input h-7 w-full rounded-md border px-2 text-xs"
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as TaskPriority)
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="text-muted-foreground mb-1 block">
                    Estimated Minutes
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={estimatedMinutes}
                    onChange={(event) => setEstimatedMinutes(event.target.value)}
                  />
                </label>
              </div>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Task"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task List</CardTitle>
          <CardDescription>GET /api/tasks + PATCH/DELETE /api/tasks/:id</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-xs">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-muted-foreground text-xs">No tasks yet.</p>
          ) : (
            <div className="grid gap-3">
              {tasks.map((task) => (
                <article key={task.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{task.title}</h3>
                      {task.description ? (
                        <p className="text-muted-foreground text-xs">
                          {task.description}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {task.priority} | {task.status} | {task.estimatedMinutes} min
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void updateTaskStatus(task.id, "not_started")}
                      disabled={activeTaskId === task.id}
                    >
                      Reset
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void updateTaskStatus(task.id, "in_progress")}
                      disabled={activeTaskId === task.id}
                    >
                      In Progress
                    </Button>
                    <Button
                      onClick={() => void updateTaskStatus(task.id, "done")}
                      disabled={activeTaskId === task.id}
                    >
                      Done
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void deleteTask(task.id)}
                      disabled={activeTaskId === task.id}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
