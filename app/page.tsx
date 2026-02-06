import { eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  RiCalendarScheduleLine,
  RiDashboardHorizontalLine,
  RiFileTextLine,
  RiNotification2Line,
  RiShieldUserLine,
  RiTodoLine,
} from "@remixicon/react";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { tasks, todoLists, user, userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";
import { normalizeLanguage } from "@/lib/i18n";
import { isAdmin } from "@/lib/roles";

const copy = {
  sr: {
    dashboard: "Time Manager Dashboard",
    welcome: "Dobrodosao, {name}. Uloga:",
    lists: "To-do liste",
    openTasks: "Otvoreni zadaci",
    dueToday: "Rok danas",
    tasksAndLists: "Zadaci i liste",
    tasksAndListsDesc: "Kreiranje lista, zadataka, statusa, prioriteta i rokova.",
    openWorkspace: "Otvori workspace",
    calendarPlanner: "Kalendar i planer",
    calendarPlannerDesc: "Dnevni, nedeljni i mesecni prikaz uz direktno dodavanje obaveza.",
    openCalendar: "Otvori kalendar",
    notesReminders: "Beleske i podsetnici",
    notesRemindersDesc: "Tekstualne beleske, kategorije, pretraga i notifikacije za obaveze.",
    openModule: "Otvori modul",
    adminZone: "Admin zona",
    adminZoneDesc: "Pregled korisnika, izmena prava pristupa i administracija naloga.",
    openAdmin: "Otvori admin panel",
  },
  en: {
    dashboard: "Time Manager Dashboard",
    welcome: "Welcome, {name}. Role:",
    lists: "To-do lists",
    openTasks: "Open tasks",
    dueToday: "Due today",
    tasksAndLists: "Tasks and lists",
    tasksAndListsDesc: "Create lists, tasks, statuses, priorities, and deadlines.",
    openWorkspace: "Open workspace",
    calendarPlanner: "Calendar and planner",
    calendarPlannerDesc: "Daily, weekly, and monthly view with direct event creation.",
    openCalendar: "Open calendar",
    notesReminders: "Notes and reminders",
    notesRemindersDesc: "Text notes, categories, search, and notifications for obligations.",
    openModule: "Open module",
    adminZone: "Admin zone",
    adminZoneDesc: "Users overview, permission updates, and account administration.",
    openAdmin: "Open admin panel",
  },
} as const;

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { role: true },
  });

  const [userTasks, userLists, preferences] = await Promise.all([
    db
      .select({
        id: tasks.id,
        status: tasks.status,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(eq(tasks.userId, session.user.id)),
    db.select({ id: todoLists.id }).from(todoLists).where(eq(todoLists.userId, session.user.id)),
    db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id),
      columns: { language: true },
    }),
  ]);

  const language = normalizeLanguage(preferences?.language);
  const text = copy[language];

  const now = new Date();
  const pendingTasks = userTasks.filter((task) => task.status !== "done").length;
  const dueToday = userTasks.filter((task) => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    return (
      due.getFullYear() === now.getFullYear() &&
      due.getMonth() === now.getMonth() &&
      due.getDate() === now.getDate()
    );
  }).length;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <Card className="notion-surface animate-in fade-in-0 slide-in-from-top-2 duration-300 overflow-hidden">
        <div className="from-primary/15 via-primary/5 to-primary/0 h-1 w-full bg-gradient-to-r" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <RiDashboardHorizontalLine />
            {text.dashboard}
          </CardTitle>
          <CardDescription>
            {text.welcome.replace("{name}", session.user.name)}{" "}
            <span className="font-medium">{currentUser?.role ?? "user"}</span>.
          </CardDescription>
          <CardAction className="hidden md:block">
            <LogoutButton variant="secondary" language={language} />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <article className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{text.lists}</p>
            <p className="mt-1 text-xl font-semibold">{userLists.length}</p>
          </article>
          <article className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{text.openTasks}</p>
            <p className="mt-1 text-xl font-semibold">{pendingTasks}</p>
          </article>
          <article className="rounded-lg border bg-background/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{text.dueToday}</p>
            <p className="mt-1 text-xl font-semibold">{dueToday}</p>
          </article>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiTodoLine />
              {text.tasksAndLists}
            </CardTitle>
            <CardDescription>{text.tasksAndListsDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tasks">
              <Button>{text.openWorkspace}</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiCalendarScheduleLine />
              {text.calendarPlanner}
            </CardTitle>
            <CardDescription>{text.calendarPlannerDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tasks">
              <Button variant="outline">{text.openCalendar}</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiFileTextLine />
              {text.notesReminders}
            </CardTitle>
            <CardDescription>{text.notesRemindersDesc}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/tasks">
              <Button variant="outline">
                <RiNotification2Line data-icon="inline-start" />
                {text.openModule}
              </Button>
            </Link>
            <div className="md:hidden">
              <LogoutButton variant="secondary" language={language} />
            </div>
          </CardContent>
        </Card>

        {isAdmin(currentUser?.role) ? (
          <Card className="notion-surface animate-in fade-in-0 slide-in-from-bottom-2 duration-700 md:col-span-2 xl:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RiShieldUserLine />
                {text.adminZone}
              </CardTitle>
              <CardDescription>{text.adminZoneDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin">
                <Button variant="outline">{text.openAdmin}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
