"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  RiAdminLine,
  RiCalendar2Line,
  RiFileTextLine,
  RiHome4Line,
  RiListCheck3,
  RiNotification2Line,
  RiPriceTag3Line,
  RiSettings3Line,
} from "@remixicon/react";
import { CalendarPanel } from "@/components/calendar-panel";
import { LogoutButton } from "@/components/logout-button";
import { NotesPanel } from "@/components/notes-panel";
import { OrganizePanel } from "@/components/organize-panel";
import { ReminderDispatchListener } from "@/components/reminder-dispatch-listener";
import { RemindersPanel } from "@/components/reminders-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { TasksPanel } from "@/components/tasks-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AppLanguage } from "@/lib/i18n";

type TodoList = {
  id: string;
  title: string;
  description?: string | null;
};

type Category = {
  id: string;
  name: string;
  color: string;
};

type Props = {
  lists: TodoList[];
  categories: Category[];
  canAccessAdmin: boolean;
  sessionUser: { id: string; name: string; email: string };
  initialLanguage: AppLanguage;
};

type WorkspaceTab = "tasks" | "calendar" | "notes" | "reminders" | "organize" | "settings";

const uiCopy = {
  sr: {
    title: "Licni organizacioni centar",
    subtitle:
      "Dobrodosao, {name}. Upravljaj zadacima, kalendarom, beleskama, podsetnicima i izgledom aplikacije.",
    home: "Pocetna",
    admin: "Admin",
    tabs: {
      tasks: "Zadaci",
      calendar: "Kalendar",
      notes: "Beleske",
      reminders: "Podsetnici",
      organize: "Organizacija",
      settings: "Podesavanja",
    },
  },
  en: {
    title: "Personal Organization Hub",
    subtitle:
      "Welcome, {name}. Manage tasks, calendar, notes, reminders, and the app appearance in one place.",
    home: "Home",
    admin: "Admin",
    tabs: {
      tasks: "Tasks",
      calendar: "Calendar",
      notes: "Notes",
      reminders: "Reminders",
      organize: "Organize",
      settings: "Settings",
    },
  },
} as const;

export function TasksPageClient({
  lists,
  categories,
  canAccessAdmin,
  sessionUser,
  initialLanguage,
}: Props) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tasks");
  const [language, setLanguage] = useState<AppLanguage>(initialLanguage);

  const copy = uiCopy[language];

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: ReactNode }> = useMemo(
    () => [
      { id: "tasks", label: copy.tabs.tasks, icon: <RiListCheck3 size={16} /> },
      { id: "calendar", label: copy.tabs.calendar, icon: <RiCalendar2Line size={16} /> },
      { id: "notes", label: copy.tabs.notes, icon: <RiFileTextLine size={16} /> },
      { id: "reminders", label: copy.tabs.reminders, icon: <RiNotification2Line size={16} /> },
      { id: "organize", label: copy.tabs.organize, icon: <RiPriceTag3Line size={16} /> },
      { id: "settings", label: copy.tabs.settings, icon: <RiSettings3Line size={16} /> },
    ],
    [copy],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
  }, [language]);

  return (
    <main className="min-h-svh bg-[--app-canvas]">
      <ReminderDispatchListener />
      <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 md:p-6">
        <Card className="notion-surface animate-in fade-in-0 slide-in-from-top-2 duration-300 overflow-hidden">
          <div className="from-primary/10 via-primary/5 to-primary/0 h-1 w-full bg-gradient-to-r" />
          <CardHeader>
            <CardTitle className="text-base">{copy.title}</CardTitle>
            <CardDescription>
              {copy.subtitle.replace("{name}", sessionUser.name)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Link href="/" className="inline-flex">
              <Button variant="outline">
                <RiHome4Line data-icon="inline-start" />
                {copy.home}
              </Button>
            </Link>
            {canAccessAdmin ? (
              <Link href="/admin" className="inline-flex">
                <Button variant="outline">
                  <RiAdminLine data-icon="inline-start" />
                  {copy.admin}
                </Button>
              </Link>
            ) : null}
            <div className="ml-auto">
              <LogoutButton variant="secondary" language={language} />
            </div>
          </CardContent>
        </Card>

        <div className="notion-surface animate-in fade-in-0 slide-in-from-top-2 duration-300 sticky top-3 z-20 flex flex-wrap gap-2 rounded-xl p-2 backdrop-blur md:top-4">
          {tabs.map((entry) => (
            <Button
              key={entry.id}
              variant={activeTab === entry.id ? "default" : "outline"}
              className="transition-all hover:-translate-y-0.5"
              onClick={() => setActiveTab(entry.id)}
            >
              {entry.icon}
              {entry.label}
            </Button>
          ))}
        </div>

        <section
          key={activeTab}
          className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
        >
          {activeTab === "tasks" ? (
            <TasksPanel
              initialLists={lists}
              initialCategories={categories}
              canAccessAdmin={canAccessAdmin}
            />
          ) : null}
          {activeTab === "calendar" ? <CalendarPanel /> : null}
          {activeTab === "notes" ? <NotesPanel /> : null}
          {activeTab === "reminders" ? <RemindersPanel /> : null}
          {activeTab === "organize" ? <OrganizePanel /> : null}
          {activeTab === "settings" ? (
            <SettingsPanel
              language={language}
              onLanguageChange={(nextLanguage) => setLanguage(nextLanguage)}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
