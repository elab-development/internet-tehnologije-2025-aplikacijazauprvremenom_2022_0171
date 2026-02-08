"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RiAlarmWarningLine, RiCalendarEventLine, RiNotification3Line } from "@remixicon/react";
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

type Props = {
  targetUserId: string;
  targetUserName: string;
  canManageDispatch: boolean;
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

export function RemindersPanel({ targetUserId, targetUserName, canManageDispatch }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [form, setForm] = useState(emptyReminderForm);
  const [deleteDialog, setDeleteDialog] = useState<Reminder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const sortedReminders = useMemo(
    () => [...reminders].sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()),
    [reminders],
  );

  const taskById = useMemo(() => new Map(tasks.map((entry) => [entry.id, entry])), [tasks]);
  const eventById = useMemo(() => new Map(events.map((entry) => [entry.id, entry])), [events]);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const tasksParams = new URLSearchParams({
        userId: targetUserId,
        limit: String(Math.min(200, QUERY_LIMITS.tasks.max)),
      });
      const eventsParams = new URLSearchParams({
        userId: targetUserId,
        limit: String(Math.min(200, QUERY_LIMITS.events.max)),
      });
      const remindersParams = new URLSearchParams({
        userId: targetUserId,
        limit: String(Math.min(200, QUERY_LIMITS.reminders.max)),
      });

      const [tasksResponse, eventsResponse, remindersResponse] = await Promise.all([
        fetch(`/api/tasks?${tasksParams.toString()}`),
        fetch(`/api/events?${eventsParams.toString()}`),
        fetch(`/api/reminders?${remindersParams.toString()}`),
      ]);

      const tasksPayload = (await tasksResponse.json()) as ApiResponse<Task[]>;
      const eventsPayload = (await eventsResponse.json()) as ApiResponse<CalendarEvent[]>;
      const remindersPayload = (await remindersResponse.json()) as ApiResponse<Reminder[]>;

      if (!tasksResponse.ok) throw new Error(tasksPayload.error?.message ?? "Neuspesno ucitavanje zadataka");
      if (!eventsResponse.ok) throw new Error(eventsPayload.error?.message ?? "Neuspesno ucitavanje dogadjaja");
      if (!remindersResponse.ok) {
        throw new Error(remindersPayload.error?.message ?? "Neuspesno ucitavanje podsetnika");
      }

      setTasks(tasksPayload.data ?? []);
      setEvents(eventsPayload.data ?? []);
      setReminders(remindersPayload.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri ucitavanju podsetnika");
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const dispatchDueReminders = useCallback(
    async (showUnavailableInfo = false) => {
      if (!canManageDispatch) {
        if (showUnavailableInfo) {
          toast.info("Slanje podsetnika je dostupno samo za trenutno prijavljen nalog.");
        }
        return;
      }

      try {
        const response = await fetch("/api/reminders/dispatch", { method: "POST" });
        const payload = (await response.json()) as ApiResponse<Array<{ id: string; message: string; remindAt: string }>>;
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Greska pri proveri podsetnika");
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
        toast.error(error instanceof Error ? error.message : "Greska pri notifikaciji");
      }
    },
    [canManageDispatch, fetchAll, permission],
  );

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
      toast.error("Podsetnik mora biti vezan za zadatak ili dogadjaj.");
      return;
    }

    setIsSaving("create");
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          taskId: form.taskId || null,
          eventId: form.eventId || null,
          message: form.message.trim(),
          remindAt: new Date(form.remindAt).toISOString(),
        }),
      });
      const payload = (await response.json()) as ApiResponse<Reminder>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno kreiranje podsetnika");
      }

      setForm(emptyReminderForm());
      toast.success("Podsetnik je kreiran.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri kreiranju podsetnika");
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
        throw new Error(payload.error?.message ?? "Neuspesna promena statusa");
      }
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri promeni statusa");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteReminder(reminder: Reminder) {
    setIsSaving(`delete-${reminder.id}`);
    try {
      const response = await fetch(`/api/reminders/${reminder.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno brisanje podsetnika");
      }
      toast.success("Podsetnik je obrisan.");
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri brisanju podsetnika");
    } finally {
      setIsSaving(null);
    }
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      toast.error("Browser ne podrzava notifikacije.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      toast.success("Notifikacije su omogucene.");
    }
  }

  return (
    <>
      <div className="grid gap-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 xl:grid-cols-[1fr_1.1fr]">
        <Card className="notion-surface">
          <CardHeader>
            <CardTitle>Novi podsetnik</CardTitle>
            <CardDescription>Podsetnik za zadatak ili kalendarsku obavezu korisnika {targetUserName}.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createReminder} className="space-y-3">
              <Input
                placeholder="Tekst podsetnika"
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select
                  value={form.taskId || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      taskId: value && value !== "none" ? value : "",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bez zadatka" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez zadatka</SelectItem>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={form.eventId || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      eventId: value && value !== "none" ? value : "",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Bez dogadjaja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez dogadjaja</SelectItem>
                    {events.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                type="datetime-local"
                value={form.remindAt}
                onChange={(event) => setForm((current) => ({ ...current, remindAt: event.target.value }))}
              />

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isSaving === "create"}>
                  <RiNotification3Line data-icon="inline-start" />
                  Sacuvaj podsetnik
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void dispatchDueReminders(true)}
                  disabled={!canManageDispatch}
                >
                  <RiAlarmWarningLine data-icon="inline-start" />
                  Proveri dospele
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void enableNotifications()}
                  disabled={!canManageDispatch}
                >
                  Omoguci notifikacije
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
                    ? "nije potvrdjeno"
                    : "nije podrzano"}
              {!canManageDispatch ? " | pregled za timskog korisnika" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SectionLoader label="Ucitavanje podsetnika..." />
            ) : sortedReminders.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nema podsetnika.</p>
            ) : (
              <div className="space-y-2">
                {sortedReminders.map((entry) => (
                  <article key={entry.id} className="rounded-lg border bg-background p-3 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{entry.message}</p>
                        <p className="text-muted-foreground">{new Date(entry.remindAt).toLocaleString("sr-RS")}</p>
                      </div>
                      <Badge variant={entry.isSent ? "secondary" : "default"}>{entry.isSent ? "Poslato" : "Ceka"}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.taskId ? (
                        <Badge variant="outline">Zadatak: {taskById.get(entry.taskId)?.title ?? "Nepoznat"}</Badge>
                      ) : null}
                      {entry.eventId ? (
                        <Badge variant="outline">
                          <RiCalendarEventLine data-icon="inline-start" />
                          Dogadjaj: {eventById.get(entry.eventId)?.title ?? "Nepoznat"}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void toggleReminderStatus(entry)}
                        disabled={isSaving === `toggle-${entry.id}`}
                      >
                        {entry.isSent ? "Vrati na cekanje" : "Oznaci kao poslato"}
                      </Button>
                      <Button size="xs" variant="destructive" onClick={() => setDeleteDialog(entry)}>
                        Obrisi
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(deleteDialog)} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisi podsetnik?</AlertDialogTitle>
            <AlertDialogDescription>
              Potvrdjujes trajno brisanje podsetnika sa porukom <span className="font-medium">{deleteDialog?.message}</span>.
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
                void deleteReminder(target);
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
