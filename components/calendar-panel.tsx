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

type ApiResponse<T> = {
  data?: T;
  error?: { message?: string };
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

export function CalendarPanel() {
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
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

  const fetchTasks = useCallback(async () => {
    const response = await fetch(`/api/tasks?limit=${Math.min(200, QUERY_LIMITS.tasks.max)}`);
    const payload = (await response.json()) as ApiResponse<Task[]>;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Neuspešno učitavanje zadataka");
    }
    setTasks(payload.data ?? []);
  }, []);

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams({
      startsFrom: range.start.toISOString(),
      startsTo: range.end.toISOString(),
      limit: String(Math.min(300, QUERY_LIMITS.events.max)),
    });
    const response = await fetch(`/api/events?${params.toString()}`);
    const payload = (await response.json()) as ApiResponse<CalendarEvent[]>;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Neuspešno učitavanje događaja");
    }
    setEvents(payload.data ?? []);
  }, [range.end, range.start]);

  useEffect(() => {
    setIsLoading(true);
    void (async () => {
      try {
        await Promise.all([fetchTasks(), fetchEvents()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Greška pri učitavanju kalendara");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [fetchEvents, fetchTasks]);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("Naziv događaja je obavezan.");
      return;
    }

    setIsSaving("create");
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        throw new Error(payload.error?.message ?? "Neuspešno kreiranje događaja");
      }
      toast.success("Događaj je sačuvan.");
      setForm(emptyEventForm(anchor));
      await fetchEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri kreiranju događaja");
    } finally {
      setIsSaving(null);
    }
  }

  async function deleteEvent(entry: CalendarEvent) {
    if (!window.confirm(`Obrisati događaj "${entry.title}"?`)) return;

    setIsSaving(`delete-${entry.id}`);
    try {
      const response = await fetch(`/api/events/${entry.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Neuspešno brisanje događaja");
      }
      toast.success("Događaj je obrisan.");
      await fetchEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri brisanju događaja");
    } finally {
      setIsSaving(null);
    }
  }

  async function editEvent(entry: CalendarEvent) {
    const title = window.prompt("Novi naziv događaja", entry.title)?.trim();
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
        throw new Error(payload.error?.message ?? "Neuspešna izmena događaja");
      }
      toast.success("Događaj je izmenjen.");
      await fetchEvents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri izmeni događaja");
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
    setSelectedDay(day);
    const date = new Date(`${day}T09:00:00`);
    setForm(emptyEventForm(date));
  }

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200 grid gap-4 xl:grid-cols-[1.15fr_1fr]">
      <Card className="notion-surface">
        <CardHeader>
          <CardTitle>Kalendar vremena</CardTitle>
          <CardDescription>Dnevni, nedeljni i mesečni prikaz obaveza.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" variant="outline" onClick={() => moveCalendar("prev")}>
              Prethodno
            </Button>
            <Button size="xs" variant="outline" onClick={() => setAnchor(new Date())}>
              Danas
            </Button>
            <Button size="xs" variant="outline" onClick={() => moveCalendar("next")}>
              Sledeće
            </Button>
            <div className="ml-auto flex gap-1">
              <Button
                size="xs"
                variant={calendarView === "day" ? "default" : "outline"}
                onClick={() => setCalendarView("day")}
              >
                Dan
              </Button>
              <Button
                size="xs"
                variant={calendarView === "week" ? "default" : "outline"}
                onClick={() => setCalendarView("week")}
              >
                Nedelja
              </Button>
              <Button
                size="xs"
                variant={calendarView === "month" ? "default" : "outline"}
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
            <SectionLoader label="Učitavanje kalendara..." />
          ) : calendarView === "month" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
                <span>Pon</span>
                <span>Uto</span>
                <span>Sre</span>
                <span>Čet</span>
                <span>Pet</span>
                <span>Sub</span>
                <span>Ned</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const key = dayKeyFromDate(day);
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const dayTasks = tasksByDay.get(key) ?? [];
                  const currentMonth = day.getMonth() === anchor.getMonth();
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onDayClick(key)}
                      className={`min-h-24 rounded-md border p-1 text-left text-[11px] ${
                        selectedDay === key ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                      } ${currentMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{day.getDate()}</span>
                        <span>{dayEvents.length + dayTasks.length}</span>
                      </div>
                      {dayEvents.slice(0, 2).map((entry) => (
                        <p key={entry.id} className="mt-1 truncate rounded bg-primary/10 px-1">
                          {entry.title}
                        </p>
                      ))}
                      {dayTasks.slice(0, 1).map((task) => (
                        <p key={task.id} className="mt-1 truncate rounded bg-muted px-1">
                          Rok: {task.title}
                        </p>
                      ))}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {days.map((day) => {
                const key = dayKeyFromDate(day);
                if (calendarView === "day" && key !== dayKeyFromDate(anchor)) return null;

                const dayEvents = eventsByDay.get(key) ?? [];
                const dayTasks = tasksByDay.get(key) ?? [];
                return (
                  <article key={key} className="rounded-lg border bg-background p-3 text-xs">
                    <h3 className="font-medium">{day.toLocaleDateString()}</h3>
                    {dayEvents.length === 0 && dayTasks.length === 0 ? (
                      <p className="text-muted-foreground">Nema obaveza.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {dayEvents.map((entry) => (
                          <div key={entry.id} className="rounded-md border bg-muted/35 p-2">
                            <p className="font-medium">{entry.title}</p>
                            <p className="text-muted-foreground">
                              {new Date(entry.startsAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              -{" "}
                              {new Date(entry.endsAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            <div className="mt-1 flex gap-1">
                              <Button size="xs" variant="outline" onClick={() => void editEvent(entry)}>
                                Uredi
                              </Button>
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() => void deleteEvent(entry)}
                                disabled={isSaving === `delete-${entry.id}`}
                              >
                                Obriši
                              </Button>
                            </div>
                          </div>
                        ))}
                        {dayTasks.map((task) => (
                          <div key={task.id} className="rounded-md border bg-background p-2">
                            <p className="font-medium">Rok zadatka: {task.title}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="notion-surface">
        <CardHeader>
          <CardTitle>Dodaj obavezu</CardTitle>
          <CardDescription>Kreiranje događaja direktno iz prikaza kalendara.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createEvent} className="space-y-3">
            <Input
              placeholder="Naziv događaja"
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
              <span className="mb-1 block text-muted-foreground">Povezan zadatak (opciono)</span>
              <select
                className="h-7 w-full rounded-md border bg-background px-2 text-xs"
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
            <Button type="submit" disabled={isSaving === "create"}>
              Sačuvaj događaj
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
