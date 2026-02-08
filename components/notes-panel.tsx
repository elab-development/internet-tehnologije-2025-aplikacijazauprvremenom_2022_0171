"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  meta?: { total: number };
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

export function NotesPanel({ targetUserId, targetUserName }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [filters, setFilters] = useState({ q: "", categoryId: "" });
  const [metaTotal, setMetaTotal] = useState<number | null>(null);
  const [form, setForm] = useState(emptyNoteForm);
  const [editor, setEditor] = useState<{ id: string; form: ReturnType<typeof emptyNoteForm> } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    const params = new URLSearchParams({ userId: targetUserId });
    const response = await fetch(`/api/categories?${params.toString()}`);
    const payload = (await response.json()) as ApiResponse<Category[]>;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Neuspešno učitavanje kategorija");
    }
    setCategories(payload.data ?? []);
  }, [targetUserId]);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        userId: targetUserId,
        limit: String(QUERY_LIMITS.notes.max),
      });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.categoryId) params.set("categoryId", filters.categoryId);

      const response = await fetch(`/api/notes?${params.toString()}`);
      const payload = (await response.json()) as ApiResponse<Note[]>;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Neuspešno učitavanje beleški");
      }

      setNotes(payload.data ?? []);
      setMetaTotal(payload.meta?.total ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri učitavanju beleški");
    } finally {
      setIsLoading(false);
    }
  }, [filters.categoryId, filters.q, targetUserId]);

  useEffect(() => {
    void (async () => {
      try {
        await fetchCategories();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Greška pri učitavanju kategorija");
      }
    })();
  }, [fetchCategories]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Naziv i sadržaj su obavezni.");
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
        throw new Error(payload.error?.message ?? "Neuspešno kreiranje beleške");
      }

      setForm(emptyNoteForm());
      toast.success("Beleška je sačuvana.");
      await fetchNotes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri kreiranju beleške");
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
      toast.error("Naziv i sadržaj su obavezni.");
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
        throw new Error(payload.error?.message ?? "Neuspešna izmena beleške");
      }

      setEditor(null);
      toast.success("Beleška je izmenjena.");
      await fetchNotes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri izmeni beleške");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteNote(note: Note) {
    if (!window.confirm(`Obrisati belešku "${note.title}"?`)) return;
    setIsSaving(`delete-${note.id}`);

    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešno brisanje beleške");
      }
      toast.success("Beleška je obrisana.");
      await fetchNotes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri brisanju beleške");
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <Card className="notion-surface">
        <CardHeader>
          <CardTitle>Nova beleška</CardTitle>
          <CardDescription>Editor sa kategorijama, pinovanjem i markdown prečicama. Korisnik: {targetUserName}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createNote} className="space-y-3">
            <Input
              placeholder="Naslov beleške"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            <div className="flex flex-wrap gap-1">
              {["**bold**", "*italic*", "- stavka", "`kod`"].map((snippet) => (
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
              placeholder="Sadržaj beleške"
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                className="h-7 rounded-md border bg-background px-2 text-xs"
                value={form.categoryId}
                onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
              >
                <option value="">Bez kategorije</option>
                {categories.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))}
                />
                Pinuj belešku
              </label>
            </div>
            <Button type="submit" disabled={isSaving === "create"}>
              Sačuvaj belešku
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {editor ? (
          <Card className="notion-surface border-primary/30">
            <CardHeader>
              <CardTitle>Izmena beleške</CardTitle>
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
              <div className="flex gap-2">
                <Button onClick={() => void saveEditor()} disabled={isSaving === `edit-${editor.id}`}>
                  Sačuvaj
                </Button>
                <Button variant="outline" onClick={() => setEditor(null)}>
                  Otkaži
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="notion-surface">
          <CardHeader>
            <CardTitle>Pretraga beleški</CardTitle>
            <CardDescription>Pretraga po ključnim rečima i kategoriji.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input
                placeholder="Pretraga..."
                value={filters.q}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              />
              <select
                className="h-7 rounded-md border bg-background px-2 text-xs"
                value={filters.categoryId}
                onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}
              >
                <option value="">Sve kategorije</option>
                {categories.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => void fetchNotes()}>
                Pretraži
              </Button>
            </div>
            {metaTotal && metaTotal > notes.length ? (
              <p className="text-[11px] text-muted-foreground">
                Prikazano {notes.length} od {metaTotal} beleški.
              </p>
            ) : null}

            {isLoading ? (
              <SectionLoader label="Učitavanje beleški..." />
            ) : notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nema beleški za izabrane filtere.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((note) => (
                  <article key={note.id} className="rounded-lg border bg-background p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-medium">
                          {note.title} {note.pinned ? "📌" : ""}
                        </h3>
                        <p className="whitespace-pre-wrap text-muted-foreground">{note.content}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="xs" variant="outline" onClick={() => openEditor(note)}>
                          Uredi
                        </Button>
                        <Button size="xs" variant="destructive" onClick={() => void deleteNote(note)}>
                          Obriši
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Izmenjeno: {new Date(note.updatedAt).toLocaleString()}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

