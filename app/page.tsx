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
import { tasks, todoLists, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

const copy = {
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
  openNotes: "Otvori beleske",
  openReminders: "Otvori podsetnike",
  adminZone: "Admin zona",
  adminZoneDesc: "Pregled korisnika, izmena prava pristupa i administracija naloga.",
  openAdmin: "Otvori admin panel",
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

  const [userTasks, userLists] = await Promise.all([
    db
      .select({
        id: tasks.id,
        status: tasks.status,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(eq(tasks.userId, session.user.id)),
    db.select({ id: todoLists.id }).from(todoLists).where(eq(todoLists.userId, session.user.id)),
  ]);

  const text = copy;

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
            <LogoutButton variant="secondary" />
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
            <Link href="/tasks?tab=calendar">
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
            <Link href="/tasks?tab=notes">
              <Button variant="outline">
                <RiFileTextLine data-icon="inline-start" />
                {text.openNotes}
              </Button>
            </Link>
            <Link href="/tasks?tab=reminders">
              <Button variant="outline">
                <RiNotification2Line data-icon="inline-start" />
                {text.openReminders}
              </Button>
            </Link>
            <div className="md:hidden">
              <LogoutButton variant="secondary" />
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
