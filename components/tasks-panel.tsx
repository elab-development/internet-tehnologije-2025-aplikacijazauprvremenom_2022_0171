"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  RiCheckDoubleLine,
  RiDeleteBinLine,
  RiEdit2Line,
  RiListCheck3,
  RiRefreshLine,
  RiTimerLine,
} from "@remixicon/react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionLoader } from "@/components/ui/section-loader";
import { Textarea } from "@/components/ui/textarea";
import { QUERY_LIMITS } from "@/lib/query-limits";
import { cn } from "@/lib/utils";

type TaskStatus = "not_started" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";

type TodoList = {
  id: string;
  title: string;
  description?: string | null;
};

type Category = {
  id: string;
  name: string;
  color: string;
};

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
};

type ApiResponse<T> = {
  data?: T;
  meta?: { total: number };
  error?: { message?: string };
};

type Props = {
  initialLists: TodoList[];
  initialCategories: Category[];
  canAccessAdmin: boolean;
  targetUserId: string;
  targetUserName: string;
  isManagerDelegating: boolean;
};

const taskStatusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "not_started", label: "Nije zapoceto" },
  { value: "in_progress", label: "U toku" },
  { value: "done", label: "Uradjeno" },
];

const taskPriorityOptions: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Nizak" },
  { value: "medium", label: "Srednji" },
  { value: "high", label: "Visok" },
];

const taskStatusClassMap: Record<
  TaskStatus,
  {
    badge: string;
    quickButton: string;
    cardBorder: string;
  }
> = {
  not_started: {
    badge:
      "border-red-500/35 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200",
    quickButton:
      "border-red-500/35 text-red-700 hover:bg-red-500/10 dark:border-red-400/30 dark:text-red-200 dark:hover:bg-red-400/10",
    cardBorder: "border-l-4 border-l-red-500/50",
  },
  in_progress: {
    badge:
      "border-yellow-500/40 bg-yellow-500/12 text-yellow-700 dark:border-yellow-400/35 dark:bg-yellow-400/10 dark:text-yellow-200",
    quickButton:
      "border-yellow-500/40 text-yellow-700 hover:bg-yellow-500/12 dark:border-yellow-400/35 dark:text-yellow-200 dark:hover:bg-yellow-400/10",
    cardBorder: "border-l-4 border-l-yellow-500/50",
  },
  done: {
    badge:
      "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
    quickButton:
      "border-emerald-500/35 text-emerald-700 hover:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-400/10",
    cardBorder: "border-l-4 border-l-emerald-500/50",
  },
};

function emptyTaskForm() {
  return {
    title: "",
    description: "",
    categoryId: "",
    priority: "medium" as TaskPriority,
    status: "not_started" as TaskStatus,
    dueDate: "",
    estimatedMinutes: "30",
  };
}

function dayKeyFromIso(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string | null) {
  if (!value) return "bez roka";
  return new Date(value).toLocaleDateString("sr-RS");
}

export function TasksPanel({
  initialLists,
  initialCategories,
  canAccessAdmin,
  targetUserId,
  targetUserName,
  isManagerDelegating,
}: Props) {
  const [lists, setLists] = useState<TodoList[]>(initialLists);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedListId, setSelectedListId] = useState("");

  const [listTitle, setListTitle] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [renameListDialog, setRenameListDialog] = useState<{
    id: string;
    initialTitle: string;
    value: string;
  } | null>(null);
  const [deleteListDialog, setDeleteListDialog] = useState<TodoList | null>(null);

  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [taskEditor, setTaskEditor] = useState<{
    id: string;
    form: ReturnType<typeof emptyTaskForm>;
  } | null>(null);
  const [deleteTaskDialog, setDeleteTaskDialog] = useState<Task | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState({
    query: "",
    categoryId: "",
    status: "",
    priority: "",
  });
  const [metaTotal, setMetaTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedListId) return;
    const exists = lists.some((entry) => entry.id === selectedListId);
    if (!exists) {
      setSelectedListId("");
      setTasks([]);
      setTaskEditor(null);
    }
  }, [lists, selectedListId]);

  const categoryMap = useMemo(() => new Map(categories.map((entry) => [entry.id, entry])), [categories]);
  const selectedList = useMemo(
    () => lists.find((entry) => entry.id === selectedListId) ?? null,
    [lists, selectedListId],
  );

  const pendingTasksCount = useMemo(() => tasks.filter((entry) => entry.status !== "done").length, [tasks]);

  const fetchLists = useCallback(async () => {
    const params = new URLSearchParams({ userId: targetUserId });
    const response = await fetch(`/api/lists?${params.toString()}`);
    const payload = (await response.json()) as ApiResponse<TodoList[]>;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Neuspesno ucitavanje listi");
    }
    setLists(payload.data ?? []);
  }, [targetUserId]);

  const fetchCategories = useCallback(async () => {
    const params = new URLSearchParams({ userId: targetUserId });
    const response = await fetch(`/api/categories?${params.toString()}`);
    const payload = (await response.json()) as ApiResponse<Category[]>;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Neuspesno ucitavanje kategorija");
    }
    setCategories(payload.data ?? []);
  }, [targetUserId]);

  const fetchTasks = useCallback(async () => {
    if (!selectedListId) {
      setTasks([]);
      setMetaTotal(null);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        userId: targetUserId,
        listId: selectedListId,
        limit: String(Math.min(120, QUERY_LIMITS.tasks.max)),
      });
      if (filters.query.trim()) params.set("q", filters.query.trim());
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.status) params.set("status", filters.status);
      if (filters.priority) params.set("priority", filters.priority);

      const response = await fetch(`/api/tasks?${params.toString()}`);
      const payload = (await response.json()) as ApiResponse<Task[]>;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Neuspesno ucitavanje zadataka");
      }
      setTasks(payload.data ?? []);
      setMetaTotal(payload.meta?.total ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri ucitavanju zadataka");
    } finally {
      setIsLoading(false);
    }
  }, [filters.categoryId, filters.priority, filters.query, filters.status, selectedListId, targetUserId]);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([fetchLists(), fetchCategories()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Greska pri ucitavanju podataka");
      }
    })();
  }, [fetchCategories, fetchLists]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  async function refreshAll() {
    try {
      await Promise.all([fetchLists(), fetchCategories(), fetchTasks()]);
      toast.success("Modul zadataka je osvezen.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri osvezavanju");
    }
  }

  async function createList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listTitle.trim()) {
      toast.error("Naziv liste je obavezan.");
      return;
    }

    setIsSaving("create-list");
    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          title: listTitle.trim(),
          description: listDescription.trim() || null,
        }),
      });
      const payload = (await response.json()) as ApiResponse<TodoList>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno kreiranje liste");
      }

      setListTitle("");
      setListDescription("");
      setLists((current) => [...current, payload.data!]);
      toast.success("Lista je kreirana. Izaberi listu za rad sa zadacima.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri kreiranju liste");
    } finally {
      setIsSaving(null);
    }
  }

  function openRenameListDialog(list: TodoList) {
    setRenameListDialog({ id: list.id, initialTitle: list.title, value: list.title });
  }

  async function renameList(listId: string, title: string) {
    setIsSaving(`rename-list-${listId}`);
    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const payload = (await response.json()) as ApiResponse<TodoList>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesna izmena liste");
      }

      setLists((current) => current.map((entry) => (entry.id === listId ? payload.data! : entry)));
      toast.success("Lista je izmenjena.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri izmeni liste");
      throw error;
    } finally {
      setIsSaving(null);
    }
  }

  async function submitRenameListDialog() {
    if (!renameListDialog) return;
    const title = renameListDialog.value.trim();
    if (!title) {
      toast.error("Naziv liste je obavezan.");
      return;
    }

    await renameList(renameListDialog.id, title);
    setRenameListDialog(null);
  }

  async function deleteList(list: TodoList) {
    setIsSaving(`delete-list-${list.id}`);
    try {
      const response = await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno brisanje liste");
      }

      setLists((current) => current.filter((entry) => entry.id !== list.id));
      if (selectedListId === list.id) {
        setSelectedListId("");
        setTasks([]);
        setTaskEditor(null);
      }
      toast.success("Lista je obrisana.");
      await fetchTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri brisanju liste");
    } finally {
      setIsSaving(null);
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedListId) {
      toast.error("Prvo izaberi listu.");
      return;
    }
    if (!taskForm.title.trim()) {
      toast.error("Naziv zadatka je obavezan.");
      return;
    }

    const estimated = Number.parseInt(taskForm.estimatedMinutes, 10);
    if (!Number.isInteger(estimated) || estimated < 1) {
      toast.error("Procena vremena mora biti pozitivan broj.");
      return;
    }

    setIsSaving("create-task");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          listId: selectedListId,
          categoryId: taskForm.categoryId || null,
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || null,
          priority: taskForm.priority,
          status: taskForm.status,
          dueDate: taskForm.dueDate ? new Date(`${taskForm.dueDate}T12:00:00`).toISOString() : null,
          estimatedMinutes: estimated,
        }),
      });
      const payload = (await response.json()) as ApiResponse<Task>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno kreiranje zadatka");
      }

      setTaskForm(emptyTaskForm());
      toast.success("Zadatak je dodat.");
      await fetchTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri kreiranju zadatka");
    } finally {
      setIsSaving(null);
    }
  }

  function openEditor(task: Task) {
    setTaskEditor({
      id: task.id,
      form: {
        title: task.title,
        description: task.description ?? "",
        categoryId: task.categoryId ?? "",
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate ? dayKeyFromIso(task.dueDate) : "",
        estimatedMinutes: String(task.estimatedMinutes),
      },
    });
  }

  async function saveEditor() {
    if (!taskEditor) return;
    const estimated = Number.parseInt(taskEditor.form.estimatedMinutes, 10);
    if (!Number.isInteger(estimated) || estimated < 1) {
      toast.error("Procena vremena mora biti pozitivan broj.");
      return;
    }

    setIsSaving(`edit-task-${taskEditor.id}`);
    try {
      const response = await fetch(`/api/tasks/${taskEditor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskEditor.form.title.trim(),
          description: taskEditor.form.description.trim() || null,
          categoryId: taskEditor.form.categoryId || null,
          priority: taskEditor.form.priority,
          status: taskEditor.form.status,
          dueDate: taskEditor.form.dueDate ? new Date(`${taskEditor.form.dueDate}T12:00:00`).toISOString() : null,
          completedAt: taskEditor.form.status === "done" ? new Date().toISOString() : null,
          estimatedMinutes: estimated,
        }),
      });
      const payload = (await response.json()) as ApiResponse<Task>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesna izmena zadatka");
      }

      setTaskEditor(null);
      toast.success("Zadatak je izmenjen.");
      await fetchTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri izmeni zadatka");
    } finally {
      setIsSaving(null);
    }
  }

  async function quickStatus(task: Task, status: TaskStatus) {
    setIsSaving(`status-${task.id}`);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          completedAt: status === "done" ? new Date().toISOString() : null,
        }),
      });
      const payload = (await response.json()) as ApiResponse<Task>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesna promena statusa");
      }

      await fetchTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri promeni statusa");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteTask(task: Task) {
    setIsSaving(`delete-task-${task.id}`);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno brisanje zadatka");
      }

      toast.success("Zadatak je obrisan.");
      if (taskEditor?.id === task.id) {
        setTaskEditor(null);
      }
      await fetchTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri brisanju zadatka");
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <>
      <div className="grid gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 xl:grid-cols-[310px_minmax(0,1fr)]">
        <Card className="notion-surface animate-in fade-in-0 slide-in-from-left-2 duration-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiListCheck3 />
              To-do liste
            </CardTitle>
            <CardDescription>
              Kreiranje, izbor i upravljanje listama.
              {isManagerDelegating ? ` Radis za: ${targetUserName}.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Ukupno listi: {lists.length}</Badge>
              {selectedList ? <Badge>Aktivna: {selectedList.title}</Badge> : null}
            </div>

            <div className="space-y-1.5">
              {lists.length === 0 ? (
                <p className="rounded-md border border-dashed bg-background/60 p-3 text-xs text-muted-foreground">
                  Nema listi. Kreiraj prvu listu.
                </p>
              ) : (
                lists.map((entry) => {
                  const isSelected = selectedListId === entry.id;
                  return (
                    <article
                      key={entry.id}
                      className={cn(
                        "rounded-md border bg-background/70 p-2.5 text-xs transition-all duration-300",
                        isSelected
                          ? "border-primary/45 bg-primary/10 shadow-sm"
                          : "hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedListId(entry.id)}
                          className="text-left"
                        >
                          <p className="font-medium">{entry.title}</p>
                          {entry.description ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{entry.description}</p>
                          ) : null}
                        </button>
                        {isSelected ? <Badge variant="secondary">aktivna</Badge> : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {!isSelected ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => setSelectedListId(entry.id)}
                          >
                            Izaberi
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={isSaving === `rename-list-${entry.id}`}
                          onClick={() => openRenameListDialog(entry)}
                        >
                          <RiEdit2Line data-icon="inline-start" />
                          Uredi
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          disabled={isSaving === `delete-list-${entry.id}`}
                          onClick={() => setDeleteListDialog(entry)}
                        >
                          <RiDeleteBinLine data-icon="inline-start" />
                          Obrisi
                        </Button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <form onSubmit={createList} className="space-y-2 border-t pt-3 animate-in fade-in-0 duration-300">
              <Input
                placeholder="Naziv liste"
                value={listTitle}
                onChange={(event) => setListTitle(event.target.value)}
              />
              <Textarea
                rows={3}
                placeholder="Opis liste (opciono)"
                value={listDescription}
                onChange={(event) => setListDescription(event.target.value)}
              />
              <Button
                type="submit"
                disabled={isSaving === "create-list"}
                className="w-full transition-transform duration-200 hover:-translate-y-0.5"
              >
                Kreiraj listu
              </Button>
            </form>

            <div className="border-t pt-3">
              <Button
                variant="outline"
                className="w-full transition-transform duration-200 hover:-translate-y-0.5"
                onClick={() => void refreshAll()}
              >
                <RiRefreshLine data-icon="inline-start" />
                Osvezi modul
              </Button>
            </div>

            {canAccessAdmin ? (
              <div className="border-t pt-3">
                <Link href="/admin" className="inline-flex w-full">
                  <Button
                    variant="outline"
                    className="w-full transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    Admin panel
                  </Button>
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selectedList ? (
            <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              <CardHeader>
                <CardTitle>Izaberi listu za nastavak</CardTitle>
                <CardDescription>
                  Zadaci ostaju skriveni dok ne selektujes jednu to-do listu sa leve strane.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lists.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nemas nijednu listu. Kreiraj listu pa je izaberi.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Klikni na listu da otkljucas kreiranje, filtriranje i prikaz zadataka.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-300 hover:-translate-y-0.5">
                <CardHeader>
                  <CardTitle>Novi zadatak</CardTitle>
                  <CardDescription>
                    Aktivna lista: <span className="font-medium">{selectedList.title}</span> | Korisnik:{" "}
                    <span className="font-medium">{targetUserName}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={createTask} className="space-y-3 animate-in fade-in-0 duration-300">
                    <Input
                      placeholder="Naziv zadatka"
                      value={taskForm.title}
                      onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                    />
                    <Textarea
                      rows={3}
                      placeholder="Opis"
                      value={taskForm.description}
                      onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                    />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                      <Select
                        value={taskForm.categoryId || "none"}
                        onValueChange={(value) =>
                          setTaskForm((current) => ({
                            ...current,
                            categoryId: value && value !== "none" ? value : "",
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Bez kategorije" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Bez kategorije</SelectItem>
                          {categories.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={taskForm.priority}
                        onValueChange={(value) =>
                          setTaskForm((current) => ({ ...current, priority: value as TaskPriority }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Prioritet" />
                        </SelectTrigger>
                        <SelectContent>
                          {taskPriorityOptions.map((entry) => (
                            <SelectItem key={entry.value} value={entry.value}>
                              {entry.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={taskForm.status}
                        onValueChange={(value) =>
                          setTaskForm((current) => ({ ...current, status: value as TaskStatus }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {taskStatusOptions.map((entry) => (
                            <SelectItem key={entry.value} value={entry.value}>
                              {entry.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={taskForm.estimatedMinutes}
                        onChange={(event) =>
                          setTaskForm((current) => ({ ...current, estimatedMinutes: event.target.value }))
                        }
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="submit"
                        disabled={isSaving === "create-task"}
                        className="transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        Dodaj zadatak
                      </Button>
                      <Badge variant="outline" className="gap-1">
                        <RiTimerLine />
                        Procena: {taskForm.estimatedMinutes || "0"} min
                      </Badge>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {taskEditor ? (
                <Card className="notion-surface border-primary/30 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                  <CardHeader>
                    <CardTitle>Izmena zadatka</CardTitle>
                    <CardDescription>Izmeni sve informacije o zadatku.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      value={taskEditor.form.title}
                      onChange={(event) =>
                        setTaskEditor((current) =>
                          current ? { ...current, form: { ...current.form, title: event.target.value } } : current,
                        )
                      }
                    />
                    <Textarea
                      rows={3}
                      value={taskEditor.form.description}
                      onChange={(event) =>
                        setTaskEditor((current) =>
                          current ? { ...current, form: { ...current.form, description: event.target.value } } : current,
                        )
                      }
                    />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                      <Select
                        value={taskEditor.form.categoryId || "none"}
                        onValueChange={(value) =>
                          setTaskEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  form: {
                                    ...current.form,
                                    categoryId: value && value !== "none" ? value : "",
                                  },
                                }
                              : current,
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Bez kategorije" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Bez kategorije</SelectItem>
                          {categories.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={taskEditor.form.priority}
                        onValueChange={(value) =>
                          setTaskEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  form: { ...current.form, priority: value as TaskPriority },
                                }
                              : current,
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Prioritet" />
                        </SelectTrigger>
                        <SelectContent>
                          {taskPriorityOptions.map((entry) => (
                            <SelectItem key={entry.value} value={entry.value}>
                              {entry.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={taskEditor.form.status}
                        onValueChange={(value) =>
                          setTaskEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  form: { ...current.form, status: value as TaskStatus },
                                }
                              : current,
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {taskStatusOptions.map((entry) => (
                            <SelectItem key={entry.value} value={entry.value}>
                              {entry.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="date"
                        value={taskEditor.form.dueDate}
                        onChange={(event) =>
                          setTaskEditor((current) =>
                            current ? { ...current, form: { ...current.form, dueDate: event.target.value } } : current,
                          )
                        }
                      />
                      <Input
                        type="number"
                        min={1}
                        value={taskEditor.form.estimatedMinutes}
                        onChange={(event) =>
                          setTaskEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  form: { ...current.form, estimatedMinutes: event.target.value },
                                }
                              : current,
                          )
                        }
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => void saveEditor()}
                        disabled={isSaving === `edit-task-${taskEditor.id}`}
                        className="transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        Sacuvaj
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setTaskEditor(null)}
                        className="transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        Otkazi
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
                <CardHeader>
                  <CardTitle>Pretraga i filtriranje zadataka</CardTitle>
                  <CardDescription>Filtriranje po recima, kategoriji, statusu i prioritetu.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <Input
                      placeholder="Pretraga..."
                      value={filters.query}
                      onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                    />

                    <Select
                      value={filters.categoryId || "all"}
                      onValueChange={(value) =>
                        setFilters((current) => ({
                          ...current,
                          categoryId: value && value !== "all" ? value : "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sve kategorije" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Sve kategorije</SelectItem>
                        {categories.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filters.status || "all"}
                      onValueChange={(value) =>
                        setFilters((current) => ({
                          ...current,
                          status: value && value !== "all" ? value : "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Svi statusi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Svi statusi</SelectItem>
                        {taskStatusOptions.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filters.priority || "all"}
                      onValueChange={(value) =>
                        setFilters((current) => ({
                          ...current,
                          priority: value && value !== "all" ? value : "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Svi prioriteti" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Svi prioriteti</SelectItem>
                        {taskPriorityOptions.map((entry) => (
                          <SelectItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void fetchTasks()}
                      className="transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      Primeni filtere
                    </Button>
                    <Button
                      variant="ghost"
                      className="transition-transform duration-200 hover:-translate-y-0.5"
                      onClick={() => setFilters({ query: "", categoryId: "", status: "", priority: "" })}
                    >
                      Reset filtera
                    </Button>
                    <Badge variant="outline" className="ml-auto">
                      Otvoreni: {pendingTasksCount}
                    </Badge>
                  </div>

                  {metaTotal && metaTotal > tasks.length ? (
                    <p className="text-[11px] text-muted-foreground">Prikazano {tasks.length} od {metaTotal} zadataka.</p>
                  ) : null}

                  {isLoading ? (
                    <SectionLoader label="Ucitavanje zadataka..." />
                  ) : tasks.length === 0 ? (
                    <p className="rounded-md border border-dashed bg-background/65 p-3 text-xs text-muted-foreground">
                      Nema zadataka za aktivne filtere.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => {
                        const statusMeta = taskStatusClassMap[task.status];
                        const statusLabel = taskStatusOptions.find((entry) => entry.value === task.status)?.label;
                        const priorityLabel = taskPriorityOptions.find((entry) => entry.value === task.priority)?.label;

                        return (
                          <article
                            key={task.id}
                            className={cn(
                              "rounded-lg border bg-background p-3 text-xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm",
                              statusMeta.cardBorder,
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h3
                                  className={cn(
                                    "text-sm font-medium",
                                    task.status === "done" && "line-through text-muted-foreground",
                                  )}
                                >
                                  {task.title}
                                </h3>
                                <p className="text-muted-foreground">{task.description || "Bez opisa"}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="transition-transform duration-200 hover:-translate-y-0.5"
                                  onClick={() => openEditor(task)}
                                >
                                  <RiEdit2Line data-icon="inline-start" />
                                  Uredi
                                </Button>
                                <Button
                                  size="xs"
                                  variant="destructive"
                                  className="transition-transform duration-200 hover:-translate-y-0.5"
                                  onClick={() => setDeleteTaskDialog(task)}
                                  disabled={isSaving === `delete-task-${task.id}`}
                                >
                                  <RiDeleteBinLine data-icon="inline-start" />
                                  Obrisi
                                </Button>
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="outline" className={statusMeta.badge}>
                                Status: {statusLabel}
                              </Badge>
                              <Badge variant="outline">Prioritet: {priorityLabel}</Badge>
                              <Badge variant="outline">Procena: {task.estimatedMinutes} min</Badge>
                              <Badge variant="outline">Rok: {formatDate(task.dueDate)}</Badge>
                              {task.categoryId ? (
                                <Badge variant="outline">
                                  Kategorija: {categoryMap.get(task.categoryId)?.name ?? "Nepoznata"}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1">
                              <Button
                                size="xs"
                                variant="outline"
                                className={`transition-transform duration-200 hover:-translate-y-0.5 ${taskStatusClassMap.not_started.quickButton}`}
                                onClick={() => void quickStatus(task, "not_started")}
                                disabled={isSaving === `status-${task.id}`}
                              >
                                Nije zapoceto
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className={`transition-transform duration-200 hover:-translate-y-0.5 ${taskStatusClassMap.in_progress.quickButton}`}
                                onClick={() => void quickStatus(task, "in_progress")}
                                disabled={isSaving === `status-${task.id}`}
                              >
                                U toku
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className={`transition-transform duration-200 hover:-translate-y-0.5 ${taskStatusClassMap.done.quickButton}`}
                                onClick={() => void quickStatus(task, "done")}
                                disabled={isSaving === `status-${task.id}`}
                              >
                                <RiCheckDoubleLine data-icon="inline-start" />
                                Uradjeno
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(renameListDialog)} onOpenChange={(open) => !open && setRenameListDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izmeni naziv liste</AlertDialogTitle>
            <AlertDialogDescription>
              Unesi novi naziv za listu <span className="font-medium">{renameListDialog?.initialTitle}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            value={renameListDialog?.value ?? ""}
            onChange={(event) =>
              setRenameListDialog((current) =>
                current ? { ...current, value: event.target.value } : current,
              )
            }
            placeholder="Novi naziv"
            autoFocus
          />

          <AlertDialogFooter>
            <AlertDialogCancel>Otkazi</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(renameListDialog && isSaving === `rename-list-${renameListDialog.id}`)}
              onClick={() => void submitRenameListDialog()}
            >
              Sacuvaj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteListDialog)} onOpenChange={(open) => !open && setDeleteListDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisi listu?</AlertDialogTitle>
            <AlertDialogDescription>
              Brisanjem liste <span className="font-medium">{deleteListDialog?.title}</span> uklanjas i njene zadatke.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkazi</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => {
                if (!deleteListDialog) return;
                const target = deleteListDialog;
                setDeleteListDialog(null);
                void deleteList(target);
              }}
            >
              Obrisi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteTaskDialog)} onOpenChange={(open) => !open && setDeleteTaskDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisi zadatak?</AlertDialogTitle>
            <AlertDialogDescription>
              Potvrdjujes trajno brisanje zadatka <span className="font-medium">{deleteTaskDialog?.title}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkazi</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => {
                if (!deleteTaskDialog) return;
                const target = deleteTaskDialog;
                setDeleteTaskDialog(null);
                void deleteTask(target);
              }}
            >
              Obrisi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
