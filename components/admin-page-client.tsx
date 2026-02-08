"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RiRefreshLine,
  RiShieldUserLine,
  RiUserSettingsLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { LogoutButton } from "@/components/logout-button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionLoader } from "@/components/ui/section-loader";
import { userRoleValues, type UserRole } from "@/lib/roles";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  managerId: string | null;
  managerName: string | null;
  teamSize: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type UsersResponse = {
  data?: AdminUser[];
  error?: { message?: string };
};

type SingleUserResponse = {
  data?: AdminUser;
  error?: { message?: string };
};

type DeleteUserResponse = {
  data?: { id: string };
  error?: { message?: string };
};

const roleLabelMap: Record<UserRole, string> = {
  user: "korisnik",
  manager: "menadzer",
  admin: "administrator",
};

const dateTimeFormatter = new Intl.DateTimeFormat("sr-RS", {
  dateStyle: "short",
  timeStyle: "medium",
});

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateTimeFormatter.format(date);
}

export function AdminPageClient() {
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [query, setQuery] = useState("");
  const [deleteUserDialog, setDeleteUserDialog] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/users", { method: "GET" });
      const payload = (await response.json()) as UsersResponse;

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Neuspesno ucitavanje korisnika");
      }

      setAllUsers(payload.data ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepoznata greska";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  async function updateUser(
    userId: string,
    payload: { role?: UserRole; isActive?: boolean; managerId?: string | null },
  ) {
    setActiveUserId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as SingleUserResponse;
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? "Neuspesna izmena korisnika");
      }

      await fetchUsers();
      toast.success("Korisnik je uspesno izmenjen.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepoznata greska";
      toast.error(message);
    } finally {
      setActiveUserId(null);
    }
  }

  async function deleteUser(userId: string) {
    setActiveUserId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const body = (await response.json()) as DeleteUserResponse;
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? "Neuspesno brisanje korisnika");
      }

      await fetchUsers();
      toast.success("Korisnik je obrisan.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepoznata greska";
      toast.error(message);
    } finally {
      setActiveUserId(null);
    }
  }

  const managerUsers = useMemo(
    () => allUsers.filter((entry) => entry.role === "manager"),
    [allUsers],
  );

  const managerById = useMemo(
    () =>
      new Map(
        managerUsers.map((entry) => [
          entry.id,
          {
            id: entry.id,
            name: entry.name.trim() ? entry.name : entry.email,
            teamSize: entry.teamSize,
            isActive: entry.isActive,
          },
        ]),
      ),
    [managerUsers],
  );

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allUsers.filter((entry) => {
      const matchesRole = roleFilter === "all" || entry.role === roleFilter;
      if (!matchesRole) return false;
      if (!normalized) return true;

      return (
        entry.name.toLowerCase().includes(normalized) ||
        entry.email.toLowerCase().includes(normalized)
      );
    });
  }, [allUsers, query, roleFilter]);

  const metrics = useMemo(() => {
    const active = allUsers.filter((entry) => entry.isActive).length;
    const admins = allUsers.filter((entry) => entry.role === "admin").length;
    const managers = allUsers.filter((entry) => entry.role === "manager").length;
    const assignedUsers = allUsers.filter(
      (entry) => entry.role === "user" && Boolean(entry.managerId),
    ).length;
    return { active, admins, managers, assignedUsers };
  }, [allUsers]);

  const managerOptions = useMemo(
    () =>
      [...managerById.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "sr", { sensitivity: "base" }),
      ),
    [managerById],
  );

  const hasActiveFilters = query.trim().length > 0 || roleFilter !== "all";

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-8 p-4 md:p-8">
      <Card className="notion-surface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiShieldUserLine />
            Administrativni centar
          </CardTitle>
          <CardDescription>
            Upravljaj ulogama, statusom naloga i pristupom korisnika na jednom mestu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Link href="/" className="inline-flex">
            <Button variant="outline">Pocetna</Button>
          </Link>
          <Link href="/tasks" className="inline-flex">
            <Button variant="outline">Zadaci</Button>
          </Link>
          <Button variant="outline" onClick={() => void fetchUsers()}>
            <RiRefreshLine data-icon="inline-start" />
            Osvezi
          </Button>
          <div className="ml-auto">
            <LogoutButton variant="secondary" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Ukupno korisnika</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {allUsers.length}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Aktivni korisnici</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {metrics.active}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Administratori / Menadzeri</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {metrics.admins} / {metrics.managers}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Dodeljeni korisnici</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {metrics.assignedUsers}
          </CardContent>
        </Card>
      </div>

      <Card className="notion-surface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiUserSettingsLine />
            Korisnici
          </CardTitle>
          <CardDescription>
            Pretrazi, pregledaj i azuriraj dozvole i statuse korisnickih naloga.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Input
              placeholder="Pretraga po imenu ili email adresi..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full md:max-w-md"
            />
            <label className="grid w-full gap-1 text-xs md:w-52">
              <span className="text-muted-foreground">Filter uloge</span>
              <Select
                value={roleFilter}
                onValueChange={(value) =>
                  setRoleFilter((value as "all" | UserRole) ?? "all")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sve uloge">
                    {roleFilter === "all" ? "Sve" : roleLabelMap[roleFilter]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve</SelectItem>
                  {userRoleValues.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabelMap[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setRoleFilter("all");
              }}
              disabled={!hasActiveFilters}
            >
              Reset filtera
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Prikazano korisnika: {filteredUsers.length} / {allUsers.length}
          </p>

          {isLoading ? (
            <SectionLoader label="Ucitavanje korisnika..." />
          ) : filteredUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nema korisnika za trenutno zadate filtere.
            </p>
          ) : (
            <div className="grid gap-4">
              {filteredUsers.map((entry) => {
                const assignedManager = entry.managerId
                  ? managerById.get(entry.managerId) ?? null
                  : null;
                const managerName =
                  assignedManager?.name ??
                  entry.managerName ??
                  (entry.managerId ? "Nedostupan menadzer" : "Nije dodeljen");
                const missingManagerOption = Boolean(
                  entry.managerId && !assignedManager,
                );

                return (
                  <article
                    key={entry.id}
                    className="rounded-xl border bg-background/70 p-4 md:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold">{entry.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {entry.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Kreiran: {formatDateTime(entry.createdAt)}
                        </p>
                        {entry.role === "user" ? (
                          <p className="text-xs text-muted-foreground">
                            Menadzer: {managerName}
                          </p>
                        ) : null}
                        {entry.role === "manager" ? (
                          <p className="text-xs text-muted-foreground">
                            Velicina tima: {entry.teamSize}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.isActive ? "default" : "secondary"}>
                          {entry.isActive ? "aktivan" : "neaktivan"}
                        </Badge>
                        <Badge variant="outline">{roleLabelMap[entry.role]}</Badge>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <label className="grid min-w-[170px] gap-1 text-xs">
                        <span className="text-muted-foreground">Uloga</span>
                        <Select
                          value={entry.role}
                          onValueChange={(value) => {
                            if (!value || value === entry.role) return;
                            void updateUser(entry.id, { role: value as UserRole });
                          }}
                          disabled={activeUserId === entry.id}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Izaberi ulogu">
                              {roleLabelMap[entry.role]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {userRoleValues.map((role) => (
                              <SelectItem key={role} value={role}>
                                {roleLabelMap[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      {entry.role === "user" ? (
                        <label className="grid min-w-[200px] gap-1 text-xs">
                          <span className="text-muted-foreground">Menadzer</span>
                          <Select
                            value={entry.managerId ?? "unassigned"}
                            onValueChange={(value) => {
                              if (!value) return;
                              const nextManagerId = value === "unassigned" ? null : value;
                              if (nextManagerId === entry.managerId) return;

                              void updateUser(entry.id, {
                                managerId: nextManagerId,
                              });
                            }}
                            disabled={activeUserId === entry.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Nije dodeljen">
                                {entry.managerId ? managerName : "Nije dodeljen"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">
                                Nije dodeljen
                              </SelectItem>
                              {missingManagerOption ? (
                                <SelectItem value={entry.managerId!} disabled>
                                  {managerName} (nedostupan)
                                </SelectItem>
                              ) : null}
                              {managerOptions.map((manager) => (
                                <SelectItem
                                  key={manager.id}
                                  value={manager.id}
                                  disabled={!manager.isActive}
                                >
                                  {manager.name} ({manager.teamSize})
                                  {manager.isActive ? "" : " - neaktivan"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </label>
                      ) : null}
                      <Button
                        variant={entry.isActive ? "destructive" : "outline"}
                        onClick={() =>
                          void updateUser(entry.id, {
                            isActive: !entry.isActive,
                          })
                        }
                        disabled={activeUserId === entry.id}
                      >
                        {entry.isActive ? "Deaktiviraj" : "Aktiviraj"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setDeleteUserDialog(entry)}
                        disabled={activeUserId === entry.id}
                      >
                        Obrisi korisnika
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deleteUserDialog)} onOpenChange={(open) => !open && setDeleteUserDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisi korisnika?</AlertDialogTitle>
            <AlertDialogDescription>
              Potvrdjujes trajno brisanje naloga{" "}
              <span className="font-medium">{deleteUserDialog?.name || deleteUserDialog?.email}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkazi</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => {
                if (!deleteUserDialog) return;
                const target = deleteUserDialog;
                setDeleteUserDialog(null);
                void deleteUser(target.id);
              }}
            >
              Obrisi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
