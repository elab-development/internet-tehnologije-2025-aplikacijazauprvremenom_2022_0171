"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionLoader } from "@/components/ui/section-loader";
import { QUERY_LIMITS } from "@/lib/query-limits";

type Task = {
  id: string;
  title: string;
};

type CalendarEvent = {
  id: string;
  title: string;
};

type Reminder = {
  id: string;
  taskId: string | null;
  eventId: string | null;
  message: string;
  remindAt: string;
  isSent: boolean;
  sentAt: string | null;
};

type ApiResponse<T> = {
  data?: T;
  error?: { message?: string };
};

function emptyReminderForm() {
  const remindAt = new Date(Date.now() + 30 * 60 * 1000);
  const local = new Date(remindAt.getTime() - remindAt.getTimezoneOffset() * 60000);
  return {
    message: "",
    taskId: "",
    eventId: "",
    remindAt: local.toISOString().slice(0, 16),
  };
}

export function RemindersPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [form, setForm] = useState(emptyReminderForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const sortedReminders = useMemo(
    () =>
      [...reminders].sort(
        (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
      ),
    [reminders],
  );

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksResponse, eventsResponse, remindersResponse] = await Promise.all([
        fetch(`/api/tasks?limit=${Math.min(200, QUERY_LIMITS.tasks.max)}`),
        fetch(`/api/events?limit=${Math.min(200, QUERY_LIMITS.events.max)}`),
        fetch(`/api/reminders?limit=${Math.min(200, QUERY_LIMITS.reminders.max)}`),
      ]);

      const tasksPayload = (await tasksResponse.json()) as ApiResponse<Task[]>;
      const eventsPayload = (await eventsResponse.json()) as ApiResponse<CalendarEvent[]>;
      const remindersPayload = (await remindersResponse.json()) as ApiResponse<Reminder[]>;

      if (!tasksResponse.ok) throw new Error(tasksPayload.error?.message ?? "Neuspešno učitavanje taskova");
      if (!eventsResponse.ok) throw new Error(eventsPayload.error?.message ?? "Neuspešno učitavanje događaja");
      if (!remindersResponse.ok) {
        throw new Error(remindersPayload.error?.message ?? "Neuspešno učitavanje podsetnika");
      }

      setTasks(tasksPayload.data ?? []);
      setEvents(eventsPayload.data ?? []);
      setReminders(remindersPayload.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri učitavanju podsetnika");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const dispatchDueReminders = useCallback(async () => {
    try {
      const response = await fetch("/api/reminders/dispatch", { method: "POST" });
      const payload = (await response.json()) as ApiResponse<
        Array<{ id: string; message: string; remindAt: string }>
      >;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Greška pri proveri podsetnika");
      }

      if (payload.data && payload.data.length > 0) {
        payload.data.forEach((entry) => {
          toast.info(`Podsetnik: ${entry.message}`);
          if (permission === "granted" && typeof Notification !== "undefined") {
            new Notification("Podsetnik", { body: entry.message });
          }
        });
      }

      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri notifikaciji");
    }
  }, [fetchAll, permission]);

  useEffect(() => {
    const interval = setInterval(() => {
      void dispatchDueReminders();
    }, 60000);

    return () => clearInterval(interval);
  }, [dispatchDueReminders]);

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.message.trim()) {
      toast.error("Tekst podsetnika je obavezan.");
      return;
    }
    if (!form.taskId && !form.eventId) {
      toast.error("Podsetnik mora biti vezan za zadatak ili događaj.");
      return;
    }

    setIsSaving("create");
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: form.taskId || null,
          eventId: form.eventId || null,
          message: form.message.trim(),
          remindAt: new Date(form.remindAt).toISOString(),
        }),
      });
      const payload = (await response.json()) as ApiResponse<Reminder>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešno kreiranje podsetnika");
      }

      setForm(emptyReminderForm());
      toast.success("Podsetnik je kreiran.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri kreiranju podsetnika");
    } finally {
      setIsSaving(null);
    }
  }

  async function toggleReminderStatus(reminder: Reminder) {
    setIsSaving(`toggle-${reminder.id}`);
    try {
      const nextSent = !reminder.isSent;
      const response = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isSent: nextSent,
          sentAt: nextSent ? new Date().toISOString() : null,
        }),
      });
      const payload = (await response.json()) as ApiResponse<Reminder>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešna promena statusa");
      }
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri promeni statusa");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteReminder(reminder: Reminder) {
    if (!window.confirm("Obrisati podsetnik?")) return;
    setIsSaving(`delete-${reminder.id}`);
    try {
      const response = await fetch(`/api/reminders/${reminder.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešno brisanje podsetnika");
      }
      toast.success("Podsetnik je obrisan.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri brisanju podsetnika");
    } finally {
      setIsSaving(null);
    }
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      toast.error("Browser ne podržava notifikacije.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      toast.success("Notifikacije su omogućene.");
    }
  }

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
      <Card className="notion-surface">
        <CardHeader>
          <CardTitle>Novi podsetnik</CardTitle>
          <CardDescription>Podsetnik za zadatak ili kalendarsku obavezu.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createReminder} className="space-y-3">
            <Input
              placeholder="Tekst podsetnika"
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                className="h-7 rounded-md border bg-background px-2 text-xs"
                value={form.taskId}
                onChange={(event) => setForm((current) => ({ ...current, taskId: event.target.value }))}
              >
                <option value="">Bez zadatka</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              <select
                className="h-7 rounded-md border bg-background px-2 text-xs"
                value={form.eventId}
                onChange={(event) => setForm((current) => ({ ...current, eventId: event.target.value }))}
              >
                <option value="">Bez događaja</option>
                {events.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
            </div>
            <Input
              type="datetime-local"
              value={form.remindAt}
              onChange={(event) => setForm((current) => ({ ...current, remindAt: event.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving === "create"}>
                Sačuvaj podsetnik
              </Button>
              <Button type="button" variant="outline" onClick={() => void dispatchDueReminders()}>
                Proveri dospele
              </Button>
              <Button type="button" variant="outline" onClick={() => void enableNotifications()}>
                Omogući notifikacije
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="notion-surface">
        <CardHeader>
          <CardTitle>Podsetnici</CardTitle>
          <CardDescription>
            Status notifikacija:{" "}
            {permission === "granted"
              ? "odobreno"
              : permission === "denied"
                ? "blokirano"
                : permission === "default"
                  ? "nije potvrđeno"
                  : "nije podržano"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SectionLoader label="Učitavanje podsetnika..." />
          ) : sortedReminders.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nema podsetnika.</p>
          ) : (
            <div className="space-y-2">
              {sortedReminders.map((entry) => (
                <article key={entry.id} className="rounded-lg border bg-background p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{entry.message}</p>
                      <p className="text-muted-foreground">{new Date(entry.remindAt).toLocaleString()}</p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] ${
                        entry.isSent ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                      }`}
                    >
                      {entry.isSent ? "Poslato" : "Čeka"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.taskId ? (
                      <span className="rounded border px-2 py-0.5">
                        Zadatak: {tasks.find((task) => task.id === entry.taskId)?.title ?? "Nepoznat"}
                      </span>
                    ) : null}
                    {entry.eventId ? (
                      <span className="rounded border px-2 py-0.5">
                        Događaj: {events.find((event) => event.id === entry.eventId)?.title ?? "Nepoznat"}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Button size="xs" variant="outline" onClick={() => void toggleReminderStatus(entry)}>
                      {entry.isSent ? "Vrati na čekanje" : "Označi kao poslato"}
                    </Button>
                    <Button size="xs" variant="destructive" onClick={() => void deleteReminder(entry)}>
                      Obriši
                    </Button>
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
