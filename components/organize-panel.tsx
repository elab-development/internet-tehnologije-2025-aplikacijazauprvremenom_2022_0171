"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QUERY_LIMITS } from "@/lib/query-limits";

type Category = {
  id: string;
  name: string;
  color: string;
};

type TodoList = {
  id: string;
  title: string;
  description: string | null;
};

type Task = {
  id: string;
  listId: string;
  categoryId: string | null;
};

type ApiResponse<T> = {
  data?: T;
  error?: { message?: string };
};

type Props = {
  targetUserId: string;
  targetUserName: string;
  isManagerDelegating: boolean;
};

export function OrganizePanel({ targetUserId, targetUserName, isManagerDelegating }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#4f8cff");
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const categoryParams = new URLSearchParams({ userId: targetUserId });
    const listParams = new URLSearchParams({ userId: targetUserId });
    const taskParams = new URLSearchParams({
      userId: targetUserId,
      limit: String(Math.min(400, QUERY_LIMITS.tasks.max)),
    });

    const [categoriesResponse, listsResponse, tasksResponse] = await Promise.all([
      fetch(`/api/categories?${categoryParams.toString()}`),
      fetch(`/api/lists?${listParams.toString()}`),
      fetch(`/api/tasks?${taskParams.toString()}`),
    ]);

    const categoriesPayload = (await categoriesResponse.json()) as ApiResponse<Category[]>;
    const listsPayload = (await listsResponse.json()) as ApiResponse<TodoList[]>;
    const tasksPayload = (await tasksResponse.json()) as ApiResponse<Task[]>;

    if (!categoriesResponse.ok) {
      throw new Error(categoriesPayload.error?.message ?? "Neuspešno učitavanje kategorija");
    }
    if (!listsResponse.ok) {
      throw new Error(listsPayload.error?.message ?? "Neuspešno učitavanje listi");
    }
    if (!tasksResponse.ok) {
      throw new Error(tasksPayload.error?.message ?? "Neuspešno učitavanje taskova");
    }

    setCategories(categoriesPayload.data ?? []);
    setLists(listsPayload.data ?? []);
    setTasks(tasksPayload.data ?? []);
  }, [targetUserId]);

  useEffect(() => {
    void (async () => {
      try {
        await fetchAll();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Greška pri učitavanju organizacije");
      }
    })();
  }, [fetchAll]);

  const tasksByList = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      map.set(task.listId, (map.get(task.listId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const tasksByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (!task.categoryId) continue;
      map.set(task.categoryId, (map.get(task.categoryId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryName.trim()) return;

    setIsSaving("create-category");
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          name: categoryName.trim(),
          color: categoryColor,
        }),
      });
      const payload = (await response.json()) as ApiResponse<Category>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešno kreiranje kategorije");
      }
      setCategoryName("");
      setCategoryColor("#4f8cff");
      toast.success("Kategorija je kreirana.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri kreiranju kategorije");
    } finally {
      setIsSaving(null);
    }
  }

  async function renameCategory(category: Category) {
    const name = window.prompt("Novi naziv kategorije", category.name)?.trim();
    if (!name) return;
    setIsSaving(`rename-category-${category.id}`);
    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as ApiResponse<Category>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešna izmena kategorije");
      }
      toast.success("Kategorija je izmenjena.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri izmeni kategorije");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Obrisati kategoriju "${category.name}"?`)) return;
    setIsSaving(`delete-category-${category.id}`);
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešno brisanje kategorije");
      }
      toast.success("Kategorija je obrisana.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri brisanju kategorije");
    } finally {
      setIsSaving(null);
    }
  }

  async function renameList(list: TodoList) {
    const title = window.prompt("Novi naziv liste", list.title)?.trim();
    if (!title) return;
    setIsSaving(`rename-list-${list.id}`);
    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const payload = (await response.json()) as ApiResponse<TodoList>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešna izmena liste");
      }
      toast.success("Lista je izmenjena.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri izmeni liste");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteList(list: TodoList) {
    if (!window.confirm(`Obrisati listu "${list.title}"?`)) return;
    setIsSaving(`delete-list-${list.id}`);
    try {
      const response = await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešno brisanje liste");
      }
      toast.success("Lista je obrisana.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri brisanju liste");
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200 grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card className="notion-surface">
        <CardHeader>
          <CardTitle>Kategorije</CardTitle>
          <CardDescription>Tagovi i kategorije za lakše filtriranje i pretragu korisnika {targetUserName}.{isManagerDelegating ? " Menadzerski pregled." : ""}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={createCategory} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_90px_auto]">
            <Input
              placeholder="Naziv kategorije"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              maxLength={120}
            />
            <Input type="color" value={categoryColor} onChange={(event) => setCategoryColor(event.target.value)} />
            <Button type="submit" disabled={isSaving === "create-category"}>
              Dodaj
            </Button>
          </form>

          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nema kategorija.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((entry) => (
                <article key={entry.id} className="rounded-md border bg-background p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full border"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="font-medium">{entry.name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {tasksByCategory.get(entry.id) ?? 0} zadataka
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Button size="xs" variant="outline" onClick={() => void renameCategory(entry)}>
                      Uredi
                    </Button>
                    <Button size="xs" variant="destructive" onClick={() => void deleteCategory(entry)}>
                      Obriši
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="notion-surface">
        <CardHeader>
          <CardTitle>To‑do liste</CardTitle>
          <CardDescription>Upravljanje nazivom i životnim ciklusom listi korisnika {targetUserName}.</CardDescription>
        </CardHeader>
        <CardContent>
          {lists.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nema listi.</p>
          ) : (
            <div className="space-y-2">
              {lists.map((entry) => (
                <article key={entry.id} className="rounded-md border bg-background p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{entry.title}</p>
                      <p className="text-muted-foreground">
                        Zadataka: {tasksByList.get(entry.id) ?? 0}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="xs" variant="outline" onClick={() => void renameList(entry)}>
                        Uredi
                      </Button>
                      <Button size="xs" variant="destructive" onClick={() => void deleteList(entry)}>
                        Obriši
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

