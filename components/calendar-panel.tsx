"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionLoader } from "@/components/ui/section-loader";
import { Textarea } from "@/components/ui/textarea";
import { QUERY_LIMITS } from "@/lib/query-limits";

type CalendarView = "day" | "week" | "month";

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  status: "not_started" | "in_progress" | "done";
};

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  taskId: string | null;
  location: string | null;
};

type Reminder = {
  id: string;
  taskId: string | null;
  eventId: string | null;
  message: string;
  remindAt: string;
  isSent: boolean;
};

type ApiResponse<T> = {
  data?: T;
  error?: { message?: string };
};

type Props = {
  targetUserId: string;
  targetUserName: string;
};

function dayKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayKeyFromIso(value: string) {
  return dayKeyFromDate(new Date(value));
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const weekday = (date.getDay() + 6) % 7;
  result.setDate(date.getDate() - weekday);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date: Date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function toLocalDateTimeInput(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function emptyEventForm(anchor = new Date()) {
  const starts = new Date(anchor);
  starts.setMinutes(0, 0, 0);
  const ends = new Date(starts);
  ends.setHours(starts.getHours() + 1);
  return {
    title: "",
    description: "",
    taskId: "",
    startsAt: toLocalDateTimeInput(starts),
    endsAt: toLocalDateTimeInput(ends),
    location: "",
  };
}

export function CalendarPanel({ targetUserId, targetUserName }: Props) {
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [form, setForm] = useState(emptyEventForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const range = useMemo(() => {
    if (calendarView === "day") {
      const start = new Date(anchor);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (calendarView === "week") {
      return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
    }
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    return { start: startOfWeek(monthStart), end: endOfWeek(monthEnd) };
  }, [anchor, calendarView]);

  const days = useMemo(() => {
    const result: Date[] = [];
    const current = new Date(range.start);
    while (current <= range.end) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [range.end, range.start]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dayKeyFromIso(event.startsAt);
      const next = map.get(key) ?? [];
      next.push(event);
      map.set(key, next);
    }
    return map;
  }, [events]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = dayKeyFromIso(task.dueDate);
      const next = map.get(key) ?? [];
      next.push(task);
      map.set(key, next);
    }
    return map;
  }, [tasks]);

  const remindersByDay = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    for (const reminder of reminders) {
      const key = dayKeyFromIso(reminder.remindAt);
      const next = map.get(key) ?? [];
      next.push(reminder);
      map.set(key, next);
    }
    return map;
  }, [reminders]);

  const selectedDayEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : [];
  const selectedDayTasks = selectedDay ? tasksByDay.get(selectedDay) ?? [] : [];
  const selectedDayReminders = selectedDay ? remindersByDay.get(selectedDay) ?? [] : [];

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams({
      userId: targetUserId,
      limit: String(Math.min(300, QUERY_LIMITS.tasks.max)),
    });
    const response = await fetch(`/api/tasks?${params.toString()}`);
    const payload = (await response.json()) as ApiResponse<Task[]>;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Neuspesno ucitavanje zadataka");
    }
    setTasks(payload.data ?? []);
  }, [targetUserId]);

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams({
      userId: targetUserId,
      startsFrom: range.start.toISOString(),
      startsTo: range.end.toISOString(),
      limit: String(Math.min(300, QUERY_LIMITS.events.max)),
    });
    const response = await fetch(`/api/events?${params.toString()}`);
    const payload = (await response.json()) as ApiResponse<CalendarEvent[]>;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Neuspesno ucitavanje dogadjaja");
    }
    setEvents(payload.data ?? []);
  }, [range.end, range.start, targetUserId]);

  const fetchReminders = useCallback(async () => {
    const params = new URLSearchParams({
      userId: targetUserId,
      remindFrom: range.start.toISOString(),
      remindTo: range.end.toISOString(),
      limit: String(Math.min(300, QUERY_LIMITS.reminders.max)),
    });
    const response = await fetch(`/api/reminders?${params.toString()}`);
    const payload = (await response.json()) as ApiResponse<Reminder[]>;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Neuspesno ucitavanje podsetnika");
    }
    setReminders(payload.data ?? []);
  }, [range.end, range.start, targetUserId]);

  useEffect(() => {
    setIsLoading(true);
    void (async () => {
      try {
        await Promise.all([fetchTasks(), fetchEvents(), fetchReminders()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Greska pri ucitavanju kalendara");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [fetchEvents, fetchReminders, fetchTasks]);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("Naziv dogadjaja je obavezan.");
      return;
    }

    setIsSaving("create");
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          taskId: form.taskId || null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          location: form.location.trim() || null,
        }),
      });
      const payload = (await response.json()) as ApiResponse<CalendarEvent>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno kreiranje dogadjaja");
      }
      toast.success("Dogadjaj je sacuvan.");
      setForm(emptyEventForm(anchor));
      await Promise.all([fetchEvents(), fetchReminders()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri kreiranju dogadjaja");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteEvent(entry: CalendarEvent) {
    if (!window.confirm(`Obrisati dogadjaj "${entry.title}"?`)) return;

    setIsSaving(`delete-${entry.id}`);
    try {
      const response = await fetch(`/api/events/${entry.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesno brisanje dogadjaja");
      }
      toast.success("Dogadjaj je obrisan.");
      await Promise.all([fetchEvents(), fetchReminders()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri brisanju dogadjaja");
    } finally {
      setIsSaving(null);
    }
  }

  async function editEvent(entry: CalendarEvent) {
    const title = window.prompt("Novi naziv dogadjaja", entry.title)?.trim();
    if (!title) return;

    setIsSaving(`edit-${entry.id}`);
    try {
      const response = await fetch(`/api/events/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const payload = (await response.json()) as ApiResponse<CalendarEvent>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspesna izmena dogadjaja");
      }
      toast.success("Dogadjaj je izmenjen.");
      await fetchEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greska pri izmeni dogadjaja");
    } finally {
      setIsSaving(null);
    }
  }

  function moveCalendar(direction: "prev" | "next") {
    setAnchor((current) => {
      const next = new Date(current);
      if (calendarView === "day") {
        next.setDate(next.getDate() + (direction === "next" ? 1 : -1));
        return next;
      }
      if (calendarView === "week") {
        next.setDate(next.getDate() + (direction === "next" ? 7 : -7));
        return next;
      }
      next.setMonth(next.getMonth() + (direction === "next" ? 1 : -1));
      return next;
    });
  }

  function onDayClick(day: string) {
    setSelectedDay((current) => (current === day ? null : day));
    const date = new Date(`${day}T09:00:00`);
    setForm(emptyEventForm(date));
  }

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 grid gap-4 xl:grid-cols-[1.15fr_1fr]">
      <Card className="notion-surface animate-in fade-in-0 slide-in-from-left-2 duration-500">
        <CardHeader>
          <CardTitle>Kalendar vremena</CardTitle>
          <CardDescription>
            Dnevni, nedeljni i mesecni prikaz obaveza. Korisnik: {targetUserName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              className="transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => moveCalendar("prev")}
            >
              Prethodno
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => setAnchor(new Date())}
            >
              Danas
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => moveCalendar("next")}
            >
              Sledece
            </Button>
            <div className="ml-auto flex gap-1">
              <Button
                size="xs"
                variant={calendarView === "day" ? "default" : "outline"}
                className="transition-transform duration-200 hover:-translate-y-0.5"
                onClick={() => setCalendarView("day")}
              >
                Dan
              </Button>
              <Button
                size="xs"
                variant={calendarView === "week" ? "default" : "outline"}
                className="transition-transform duration-200 hover:-translate-y-0.5"
                onClick={() => setCalendarView("week")}
              >
                Nedelja
              </Button>
              <Button
                size="xs"
                variant={calendarView === "month" ? "default" : "outline"}
                className="transition-transform duration-200 hover:-translate-y-0.5"
                onClick={() => setCalendarView("month")}
              >
                Mesec
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Opseg: {range.start.toLocaleDateString()} - {range.end.toLocaleDateString()}
          </p>

          {isLoading ? (
            <SectionLoader label="Ucitavanje kalendara..." />
          ) : (
            <div className={`grid gap-3 ${selectedDay ? "xl:grid-cols-[minmax(0,1fr)_280px]" : "grid-cols-1"}`}>
              <div className="space-y-2">
                {calendarView === "month" ? (
                  <>
                    <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
                      <span>Pon</span>
                      <span>Uto</span>
                      <span>Sre</span>
                      <span>Cet</span>
                      <span>Pet</span>
                      <span>Sub</span>
                      <span>Ned</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {days.map((day) => {
                        const key = dayKeyFromDate(day);
                        const dayEvents = eventsByDay.get(key) ?? [];
                        const dayTasks = tasksByDay.get(key) ?? [];
                        const dayReminders = remindersByDay.get(key) ?? [];
                        const currentMonth = day.getMonth() === anchor.getMonth();
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => onDayClick(key)}
                            className={`min-h-24 rounded-md border p-1 text-left text-[11px] transition-all duration-200 ${
                              selectedDay === key
                                ? "border-primary bg-primary/10 shadow-sm"
                                : "hover:-translate-y-0.5 hover:bg-muted/50"
                            } ${currentMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{day.getDate()}</span>
                              <span>{dayEvents.length + dayTasks.length + dayReminders.length}</span>
                            </div>
                            {dayEvents.slice(0, 1).map((entry) => (
                              <p key={entry.id} className="mt-1 truncate rounded bg-primary/10 px-1">
                                E: {entry.title}
                              </p>
                            ))}
                            {dayTasks.slice(0, 1).map((task) => (
                              <p key={task.id} className="mt-1 truncate rounded bg-muted px-1">
                                T: {task.title}
                              </p>
                            ))}
                            {dayReminders.slice(0, 1).map((reminder) => (
                              <p key={reminder.id} className="mt-1 truncate rounded bg-amber-500/10 px-1">
                                R: {reminder.message}
                              </p>
                            ))}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    {days.map((day) => {
                      const key = dayKeyFromDate(day);
                      if (calendarView === "day" && key !== dayKeyFromDate(anchor)) return null;

                      const dayEvents = eventsByDay.get(key) ?? [];
                      const dayTasks = tasksByDay.get(key) ?? [];
                      const dayReminders = remindersByDay.get(key) ?? [];
                      return (
                        <article
                          key={key}
                          className={`rounded-lg border bg-background p-3 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                            selectedDay === key ? "border-primary/60" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => onDayClick(key)}
                          >
                            <h3 className="font-medium">{day.toLocaleDateString()}</h3>
                            <p className="text-muted-foreground">
                              {dayEvents.length} dogadjaja, {dayTasks.length} taskova, {dayReminders.length} podsetnika
                            </p>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedDay ? (
                <aside className="notion-surface animate-in fade-in-0 slide-in-from-right-2 duration-300 rounded-lg p-3 text-xs xl:sticky xl:top-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mini pregled dana</p>
                      <p className="font-medium">{new Date(`${selectedDay}T00:00:00`).toLocaleDateString()}</p>
                    </div>
                    <Button size="xs" variant="outline" onClick={() => setSelectedDay(null)}>
                      Zatvori
                    </Button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="rounded-md border bg-background/70 p-2">
                      <p className="font-medium">Dogadjaji ({selectedDayEvents.length})</p>
                      {selectedDayEvents.length === 0 ? (
                        <p className="text-muted-foreground">Nema dogadjaja.</p>
                      ) : (
                        selectedDayEvents.map((entry) => (
                          <div key={entry.id} className="mt-1 rounded border bg-background p-1.5">
                            <p className="truncate text-muted-foreground">- {entry.title}</p>
                            <div className="mt-1 flex gap-1">
                              <Button size="xs" variant="outline" onClick={() => void editEvent(entry)}>
                                Uredi
                              </Button>
                              <Button
                                size="xs"
                                variant="destructive"
                                disabled={isSaving === `delete-${entry.id}`}
                                onClick={() => void deleteEvent(entry)}
                              >
                                Obrisi
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="rounded-md border bg-background/70 p-2">
                      <p className="font-medium">Taskovi ({selectedDayTasks.length})</p>
                      {selectedDayTasks.length === 0 ? (
                        <p className="text-muted-foreground">Nema taskova.</p>
                      ) : (
                        selectedDayTasks.map((task) => (
                          <p key={task.id} className="truncate text-muted-foreground">
                            - {task.title}
                          </p>
                        ))
                      )}
                    </div>
                    <div className="rounded-md border bg-background/70 p-2">
                      <p className="font-medium">Podsetnici ({selectedDayReminders.length})</p>
                      {selectedDayReminders.length === 0 ? (
                        <p className="text-muted-foreground">Nema podsetnika.</p>
                      ) : (
                        selectedDayReminders.map((reminder) => (
                          <p key={reminder.id} className="truncate text-muted-foreground">
                            - {reminder.message}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                </aside>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="notion-surface animate-in fade-in-0 slide-in-from-right-2 duration-500 hover:-translate-y-0.5">
        <CardHeader>
          <CardTitle>Dodaj obavezu</CardTitle>
          <CardDescription>
            Kreiranje dogadjaja direktno iz prikaza kalendara za korisnika {targetUserName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createEvent} className="space-y-3 animate-in fade-in-0 duration-300">
            <Input
              placeholder="Naziv dogadjaja"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            <Textarea
              rows={2}
              placeholder="Opis"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Povezan task (opciono)</span>
              <select
                className="h-7 w-full rounded-md border bg-background px-2 text-xs transition-colors duration-200 hover:border-primary/40"
                value={form.taskId}
                onChange={(event) => setForm((current) => ({ ...current, taskId: event.target.value }))}
              >
                <option value="">Bez povezivanja</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
              />
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              />
            </div>
            <Input
              placeholder="Lokacija"
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            />
            <Button
              type="submit"
              disabled={isSaving === "create"}
              className="transition-transform duration-200 hover:-translate-y-0.5"
            >
              Sacuvaj dogadjaj
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
