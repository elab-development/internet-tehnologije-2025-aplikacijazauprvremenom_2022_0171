"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RiDeleteBinLine, RiEdit2Line, RiPriceTag3Line } from "@remixicon/react";
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

  const [renameCategoryDialog, setRenameCategoryDialog] = useState<{
    id: string;
    initialName: string;
    value: string;
  } | null>(null);
  const [deleteCategoryDialog, setDeleteCategoryDialog] = useState<Category | null>(null);
  const [renameListDialog, setRenameListDialog] = useState<{
    id: string;
    initialTitle: string;
    value: string;
  } | null>(null);
  const [deleteListDialog, setDeleteListDialog] = useState<TodoList | null>(null);

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
      throw new Error(categoriesPayload.error?.message ?? "Neuspesno ucitavanje kategorija");
    }
    if (!listsResponse.ok) {
      throw new Error(listsPayload.error?.message ?? "Neuspesno ucitavanje listi");
    }
    if (!tasksResponse.ok) {
      throw new Error(tasksPayload.error?.message ?? "Neuspesno ucitavanje zadataka");
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
        toast.error(error instanceof Error ? error.message : "Greska pri ucitavanju organizacije");
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
    if (!categoryName.trim()) {
      toast.error("Naziv kategorije je obavezan.");
      return;
    }

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
        throw new Error(payload.error?.message ?? "Neuspesno kreiranje kategorije");
      }
      setCategoryName("");
      setCategoryColor("#4f8cff");
      toast.success("Kategorija je kreirana.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri kreiranju kategorije");
    } finally {
      setIsSaving(null);
    }
  }

  async function renameCategory(categoryId: string, name: string) {
    setIsSaving(`rename-category-${categoryId}`);
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as ApiResponse<Category>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesna izmena kategorije");
      }
      toast.success("Kategorija je izmenjena.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri izmeni kategorije");
      throw error;
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteCategory(category: Category) {
    setIsSaving(`delete-category-${category.id}`);
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno brisanje kategorije");
      }
      toast.success("Kategorija je obrisana.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri brisanju kategorije");
    } finally {
      setIsSaving(null);
    }
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
      toast.success("Lista je izmenjena.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri izmeni liste");
      throw error;
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteList(list: TodoList) {
    setIsSaving(`delete-list-${list.id}`);
    try {
      const response = await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno brisanje liste");
      }
      toast.success("Lista je obrisana.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri brisanju liste");
    } finally {
      setIsSaving(null);
    }
  }

  async function submitRenameCategory() {
    if (!renameCategoryDialog) return;
    const name = renameCategoryDialog.value.trim();
    if (!name) {
      toast.error("Naziv kategorije je obavezan.");
      return;
    }

    await renameCategory(renameCategoryDialog.id, name);
    setRenameCategoryDialog(null);
  }

  async function submitRenameList() {
    if (!renameListDialog) return;
    const title = renameListDialog.value.trim();
    if (!title) {
      toast.error("Naziv liste je obavezan.");
      return;
    }

    await renameList(renameListDialog.id, title);
    setRenameListDialog(null);
  }

  return (
    <>
      <div className="grid gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 xl:grid-cols-[1fr_1fr]">
        <Card className="notion-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiPriceTag3Line />
              Kategorije
            </CardTitle>
            <CardDescription>
              Tagovi i kategorije za lakse filtriranje korisnika {targetUserName}.
              {isManagerDelegating ? " Menadzerski pregled." : ""}
            </CardDescription>
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
                  <article key={entry.id} className="rounded-md border bg-background p-3 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 rounded-full border"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="font-medium">{entry.name}</span>
                      </div>
                      <Badge variant="outline">{tasksByCategory.get(entry.id) ?? 0} zadataka</Badge>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={isSaving === `rename-category-${entry.id}`}
                        onClick={() =>
                          setRenameCategoryDialog({ id: entry.id, initialName: entry.name, value: entry.name })
                        }
                      >
                        <RiEdit2Line data-icon="inline-start" />
                        Uredi
                      </Button>
                      <Button size="xs" variant="destructive" onClick={() => setDeleteCategoryDialog(entry)}>
                        <RiDeleteBinLine data-icon="inline-start" />
                        Obrisi
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
            <CardTitle>To-do liste</CardTitle>
            <CardDescription>Upravljanje nazivom i ciklusom listi korisnika {targetUserName}.</CardDescription>
          </CardHeader>
          <CardContent>
            {lists.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nema listi.</p>
            ) : (
              <div className="space-y-2">
                {lists.map((entry) => (
                  <article key={entry.id} className="rounded-md border bg-background p-3 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{entry.title}</p>
                        <p className="text-muted-foreground">Zadataka: {tasksByList.get(entry.id) ?? 0}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={isSaving === `rename-list-${entry.id}`}
                          onClick={() =>
                            setRenameListDialog({ id: entry.id, initialTitle: entry.title, value: entry.title })
                          }
                        >
                          <RiEdit2Line data-icon="inline-start" />
                          Uredi
                        </Button>
                        <Button size="xs" variant="destructive" onClick={() => setDeleteListDialog(entry)}>
                          <RiDeleteBinLine data-icon="inline-start" />
                          Obrisi
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

      <AlertDialog open={Boolean(renameCategoryDialog)} onOpenChange={(open) => !open && setRenameCategoryDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izmeni kategoriju</AlertDialogTitle>
            <AlertDialogDescription>
              Unesi novi naziv za kategoriju <span className="font-medium">{renameCategoryDialog?.initialName}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={renameCategoryDialog?.value ?? ""}
            onChange={(event) =>
              setRenameCategoryDialog((current) =>
                current ? { ...current, value: event.target.value } : current,
              )
            }
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Otkazi</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submitRenameCategory()}>Sacuvaj</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(renameListDialog)} onOpenChange={(open) => !open && setRenameListDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izmeni listu</AlertDialogTitle>
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
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Otkazi</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submitRenameList()}>Sacuvaj</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteCategoryDialog)} onOpenChange={(open) => !open && setDeleteCategoryDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisi kategoriju?</AlertDialogTitle>
            <AlertDialogDescription>
              Potvrdjujes trajno brisanje kategorije <span className="font-medium">{deleteCategoryDialog?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkazi</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => {
                if (!deleteCategoryDialog) return;
                const target = deleteCategoryDialog;
                setDeleteCategoryDialog(null);
                void deleteCategory(target);
              }}
            >
              Obrisi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteListDialog)} onOpenChange={(open) => !open && setDeleteListDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisi listu?</AlertDialogTitle>
            <AlertDialogDescription>
              Potvrdjujes trajno brisanje liste <span className="font-medium">{deleteListDialog?.title}</span>.
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
    </>
  );
}
