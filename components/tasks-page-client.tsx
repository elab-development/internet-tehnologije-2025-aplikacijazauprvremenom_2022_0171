"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
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
import type { UserRole } from "@/lib/roles";

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
  managerTeamMembers: Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  }>;
  canAccessAdmin: boolean;
  sessionUser: { id: string; name: string; email: string; role: UserRole };
};

type WorkspaceTab = "tasks" | "calendar" | "notes" | "reminders" | "organize" | "settings";

function parseWorkspaceTab(value: string | null): WorkspaceTab {
  if (value === "calendar") return "calendar";
  if (value === "notes") return "notes";
  if (value === "reminders") return "reminders";
  if (value === "organize") return "organize";
  if (value === "settings") return "settings";
  return "tasks";
}

const uiCopy = {
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
} as const;

export function TasksPageClient({
  lists,
  categories,
  managerTeamMembers,
  canAccessAdmin,
  sessionUser,
}: Props) {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab");
  const initialTab = useMemo(() => parseWorkspaceTab(queryTab), [queryTab]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState(sessionUser.id);
  const copy = uiCopy;
  const isManagerActor = sessionUser.role === "manager";

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const managerTargets = useMemo(
    () =>
      isManagerActor
        ? [
            {
              id: sessionUser.id,
              name: sessionUser.name,
              email: sessionUser.email,
              isActive: true,
              isSelf: true,
            },
            ...managerTeamMembers.map((entry) => ({ ...entry, isSelf: false })),
          ]
        : [],
    [isManagerActor, managerTeamMembers, sessionUser.email, sessionUser.id, sessionUser.name],
  );

  useEffect(() => {
    if (!isManagerActor) {
      setSelectedTargetUserId(sessionUser.id);
      return;
    }

    const allowedIds = new Set(managerTargets.map((entry) => entry.id));
    if (!allowedIds.has(selectedTargetUserId)) {
      setSelectedTargetUserId(sessionUser.id);
    }
  }, [isManagerActor, managerTargets, selectedTargetUserId, sessionUser.id]);

  const activeTargetUserId = isManagerActor ? selectedTargetUserId : sessionUser.id;
  const activeTargetUser = useMemo(() => {
    if (!isManagerActor) {
      return {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        isActive: true,
        isSelf: true,
      };
    }

    return (
      managerTargets.find((entry) => entry.id === activeTargetUserId) ?? managerTargets[0] ?? {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        isActive: true,
        isSelf: true,
      }
    );
  }, [activeTargetUserId, isManagerActor, managerTargets, sessionUser.email, sessionUser.id, sessionUser.name]);

  const isManagerDelegating = isManagerActor && activeTargetUserId !== sessionUser.id;

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

  return (
    <main className="min-h-svh bg-[--app-canvas]">
      <ReminderDispatchListener />
      <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 md:p-6">
        <Card className="notion-surface animate-in fade-in-0 slide-in-from-top-2 duration-500 overflow-hidden">
          <div className="from-primary/10 via-primary/5 to-primary/0 h-1 w-full bg-gradient-to-r" />
          <CardHeader>
            <CardTitle className="text-base">{copy.title}</CardTitle>
            <CardDescription>
              {copy.subtitle.replace("{name}", sessionUser.name)}
              {isManagerActor ? ` Aktivni korisnik: ${activeTargetUser.name}.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Link href="/" className="inline-flex">
              <Button variant="outline" className="transition-transform duration-200 hover:-translate-y-0.5">
                <RiHome4Line data-icon="inline-start" />
                {copy.home}
              </Button>
            </Link>
            {canAccessAdmin ? (
              <Link href="/admin" className="inline-flex">
                <Button variant="outline" className="transition-transform duration-200 hover:-translate-y-0.5">
                  <RiAdminLine data-icon="inline-start" />
                  {copy.admin}
                </Button>
              </Link>
            ) : null}
            {isManagerActor ? (
              <label className="min-w-[220px] text-xs">
                <span className="mb-1 block text-muted-foreground">Clan tima</span>
                <select
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs transition-colors duration-200 hover:border-primary/40"
                  value={activeTargetUserId}
                  onChange={(event) => setSelectedTargetUserId(event.target.value)}
                >
                  {managerTargets.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.isSelf ? "Moj nalog" : entry.name}
                      {entry.isActive ? "" : " (neaktivan)"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="ml-auto">
              <LogoutButton variant="secondary" className="transition-transform duration-200 hover:-translate-y-0.5" />
            </div>
          </CardContent>
        </Card>

        <div className="notion-surface animate-in fade-in-0 slide-in-from-top-2 duration-700 sticky top-3 z-20 flex flex-wrap gap-2 rounded-xl p-2 backdrop-blur md:top-4">
          {tabs.map((entry) => (
            <Button
              key={entry.id}
              variant={activeTab === entry.id ? "default" : "outline"}
              className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm"
              onClick={() => setActiveTab(entry.id)}
            >
              {entry.icon}
              {entry.label}
            </Button>
          ))}
        </div>

        <section
          key={`${activeTab}-${activeTargetUserId}`}
          className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
        >
          {activeTab === "tasks" ? (
            <TasksPanel
              initialLists={activeTargetUserId === sessionUser.id ? lists : []}
              initialCategories={activeTargetUserId === sessionUser.id ? categories : []}
              canAccessAdmin={canAccessAdmin}
              targetUserId={activeTargetUserId}
              targetUserName={activeTargetUser.name}
              isManagerDelegating={isManagerDelegating}
            />
          ) : null}
          {activeTab === "calendar" ? (
            <CalendarPanel
              targetUserId={activeTargetUserId}
              targetUserName={activeTargetUser.name}
            />
          ) : null}
          {activeTab === "notes" ? (
            <NotesPanel
              targetUserId={activeTargetUserId}
              targetUserName={activeTargetUser.name}
            />
          ) : null}
          {activeTab === "reminders" ? (
            <RemindersPanel
              targetUserId={activeTargetUserId}
              targetUserName={activeTargetUser.name}
              canManageDispatch={activeTargetUserId === sessionUser.id}
            />
          ) : null}
          {activeTab === "organize" ? (
            <OrganizePanel
              targetUserId={activeTargetUserId}
              targetUserName={activeTargetUser.name}
              isManagerDelegating={isManagerDelegating}
            />
          ) : null}
          {activeTab === "settings" ? <SettingsPanel /> : null}
        </section>
      </div>
    </main>
  );
}
