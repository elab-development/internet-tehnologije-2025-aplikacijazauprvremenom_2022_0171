"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RiEdit2Line, RiPushpin2Fill, RiPushpin2Line, RiSearch2Line } from "@remixicon/react";
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

type Category = {
  id: string;
  name: string;
  color: string;
};

type Note = {
  id: string;
  title: string;
  content: string;
  categoryId: string | null;
  pinned: boolean;
  updatedAt: string;
};

type ApiResponse<T> = {
  data?: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

type Props = {
  targetUserId: string;
  targetUserName: string;
};

function emptyNoteForm() {
  return {
    title: "",
    content: "",
    categoryId: "",
    pinned: false,
  };
}

const markdownSnippets = ["**bold**", "*italic*", "- stavka", "`kod`"];

export function NotesPanel({ targetUserId, targetUserName }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [filters, setFilters] = useState({ q: "", categoryId: "" });
  const [metaTotal, setMetaTotal] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState(emptyNoteForm);
  const [editor, setEditor] = useState<{ id: string; form: ReturnType<typeof emptyNoteForm> } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const notesPerPage = QUERY_LIMITS.notes.default;

  const categoriesById = useMemo(() => new Map(categories.map((entry) => [entry.id, entry])), [categories]);

  const fetchCategories = useCallback(async () => {
    const params = new URLSearchParams({ userId: targetUserId });
    const response = await fetch(`/api/categories?${params.toString()}`);
    const payload = (await response.json()) as ApiResponse<Category[]>;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Neuspesno ucitavanje kategorija");
    }
    setCategories(payload.data ?? []);
  }, [targetUserId]);

  const fetchNotes = useCallback(async () => {
    const page = currentPage;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        userId: targetUserId,
        page: String(page),
        limit: String(notesPerPage),
      });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.categoryId) params.set("categoryId", filters.categoryId);

      const response = await fetch(`/api/notes?${params.toString()}`);
      const payload = (await response.json()) as ApiResponse<Note[]>;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Neuspesno ucitavanje beleski");
      }

      setNotes(payload.data ?? []);
      setMetaTotal(payload.meta?.total ?? null);
      setTotalPages(payload.meta?.totalPages ?? 1);
      setCurrentPage(payload.meta?.page ?? page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri ucitavanju beleski");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filters.categoryId, filters.q, notesPerPage, targetUserId]);

  useEffect(() => {
    void (async () => {
      try {
        await fetchCategories();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Greska pri ucitavanju kategorija");
      }
    })();
  }, [fetchCategories]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    setCurrentPage(1);
    setTotalPages(1);
  }, [targetUserId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.categoryId, filters.q]);

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Naziv i sadrzaj su obavezni.");
      return;
    }

    setIsSaving("create");
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          title: form.title.trim(),
          content: form.content.trim(),
          categoryId: form.categoryId || null,
          pinned: form.pinned,
        }),
      });
      const payload = (await response.json()) as ApiResponse<Note>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno kreiranje beleske");
      }

      setForm(emptyNoteForm());
      toast.success("Beleska je sacuvana.");
      await fetchNotes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri kreiranju beleske");
    } finally {
      setIsSaving(null);
    }
  }

  function openEditor(note: Note) {
    setEditor({
      id: note.id,
      form: {
        title: note.title,
        content: note.content,
        categoryId: note.categoryId ?? "",
        pinned: note.pinned,
      },
    });
  }

  async function saveEditor() {
    if (!editor) return;
    if (!editor.form.title.trim() || !editor.form.content.trim()) {
      toast.error("Naziv i sadrzaj su obavezni.");
      return;
    }

    setIsSaving(`edit-${editor.id}`);
    try {
      const response = await fetch(`/api/notes/${editor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editor.form.title.trim(),
          content: editor.form.content.trim(),
          categoryId: editor.form.categoryId || null,
          pinned: editor.form.pinned,
        }),
      });
      const payload = (await response.json()) as ApiResponse<Note>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesna izmena beleske");
      }

      setEditor(null);
      toast.success("Beleska je izmenjena.");
      await fetchNotes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri izmeni beleske");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteNote(note: Note) {
    setIsSaving(`delete-${note.id}`);
    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno brisanje beleske");
      }
      toast.success("Beleska je obrisana.");
      await fetchNotes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri brisanju beleske");
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <>
      <div className="grid gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 xl:grid-cols-[1fr_1.2fr]">
        <Card className="notion-surface">
          <CardHeader>
            <CardTitle>Nova beleska</CardTitle>
            <CardDescription>Editor sa kategorijama i pinovanjem. Korisnik: {targetUserName}.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createNote} className="space-y-3">
              <Input
                placeholder="Naslov beleske"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
              <div className="flex flex-wrap gap-1">
                {markdownSnippets.map((snippet) => (
                  <Button
                    key={snippet}
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        content: current.content ? `${current.content}\n${snippet}` : snippet,
                      }))
                    }
                  >
                    {snippet}
                  </Button>
                ))}
              </div>
              <Textarea
                rows={10}
                placeholder="Sadrzaj beleske"
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select
                  value={form.categoryId || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
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

                <Button
                  type="button"
                  variant={form.pinned ? "secondary" : "outline"}
                  onClick={() => setForm((current) => ({ ...current, pinned: !current.pinned }))}
                  className="justify-start"
                >
                  {form.pinned ? <RiPushpin2Fill data-icon="inline-start" /> : <RiPushpin2Line data-icon="inline-start" />}
                  {form.pinned ? "Pinovano" : "Pinuj belesku"}
                </Button>
              </div>

              <Button type="submit" disabled={isSaving === "create"}>
                Sacuvaj belesku
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {editor ? (
            <Card className="notion-surface border-primary/30">
              <CardHeader>
                <CardTitle>Izmena beleske</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={editor.form.title}
                  onChange={(event) =>
                    setEditor((current) =>
                      current ? { ...current, form: { ...current.form, title: event.target.value } } : current,
                    )
                  }
                />
                <Textarea
                  rows={8}
                  value={editor.form.content}
                  onChange={(event) =>
                    setEditor((current) =>
                      current ? { ...current, form: { ...current.form, content: event.target.value } } : current,
                    )
                  }
                />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Select
                    value={editor.form.categoryId || "none"}
                    onValueChange={(value) =>
                      setEditor((current) =>
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
                  <Button
                    type="button"
                    variant={editor.form.pinned ? "secondary" : "outline"}
                    onClick={() =>
                      setEditor((current) =>
                        current ? { ...current, form: { ...current.form, pinned: !current.form.pinned } } : current,
                      )
                    }
                    className="justify-start"
                  >
                    {editor.form.pinned ? <RiPushpin2Fill data-icon="inline-start" /> : <RiPushpin2Line data-icon="inline-start" />}
                    {editor.form.pinned ? "Pinovano" : "Pinuj belesku"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void saveEditor()} disabled={isSaving === `edit-${editor.id}`}>
                    Sacuvaj
                  </Button>
                  <Button variant="outline" onClick={() => setEditor(null)}>
                    Otkazi
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="notion-surface">
            <CardHeader>
              <CardTitle>Pretraga beleski</CardTitle>
              <CardDescription>Pretraga po kljucnim recima i kategoriji.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_auto_auto]">
                <Input
                  placeholder="Pretraga..."
                  value={filters.q}
                  onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
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
                <Button variant="outline" onClick={() => setCurrentPage(1)}>
                  <RiSearch2Line data-icon="inline-start" />
                  Pretrazi
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilters({ q: "", categoryId: "" });
                    setCurrentPage(1);
                  }}
                >
                  Reset
                </Button>
              </div>
              {metaTotal && metaTotal > notes.length ? (
                <p className="text-[11px] text-muted-foreground">Prikazano {notes.length} od {metaTotal} beleski.</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Strana {currentPage} / {totalPages}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isLoading || currentPage <= 1}
                  onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                >
                  Prethodna
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isLoading || currentPage >= totalPages}
                  onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
                >
                  Sledeca
                </Button>
              </div>

              {isLoading ? (
                <SectionLoader label="Ucitavanje beleski..." />
              ) : notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nema beleski za izabrane filtere.</p>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => {
                    const category = note.categoryId ? categoriesById.get(note.categoryId) : null;

                    return (
                      <article key={note.id} className="rounded-lg border bg-background p-3 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-sm font-medium">{note.title}</h3>
                              {note.pinned ? (
                                <Badge variant="secondary" className="gap-1">
                                  <RiPushpin2Fill />
                                  Pin
                                </Badge>
                              ) : null}
                              {category ? (
                                <Badge variant="outline" className="gap-1">
                                  <span
                                    className="size-2 rounded-full border"
                                    style={{ backgroundColor: category.color }}
                                  />
                                  {category.name}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="whitespace-pre-wrap text-muted-foreground">{note.content}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="xs" variant="outline" onClick={() => openEditor(note)}>
                              <RiEdit2Line data-icon="inline-start" />
                              Uredi
                            </Button>
                            <Button size="xs" variant="destructive" onClick={() => setDeleteDialog(note)}>
                              Obrisi
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Izmenjeno: {new Date(note.updatedAt).toLocaleString("sr-RS")}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteDialog)} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisi belesku?</AlertDialogTitle>
            <AlertDialogDescription>
              Potvrdjujes trajno brisanje beleske <span className="font-medium">{deleteDialog?.title}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkazi</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => {
                if (!deleteDialog) return;
                const target = deleteDialog;
                setDeleteDialog(null);
                void deleteNote(target);
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
