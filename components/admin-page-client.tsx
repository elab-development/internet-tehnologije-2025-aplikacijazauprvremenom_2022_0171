"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RiRefreshLine, RiShieldUserLine, RiUserSettingsLine } from "@remixicon/react";
import { toast } from "sonner";
import { LogoutButton } from "@/components/logout-button";
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
import { SectionLoader } from "@/components/ui/section-loader";
import { userRoleValues, type UserRole } from "@/lib/roles";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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

export function AdminPageClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<"" | UserRole>("");
  const [query, setQuery] = useState("");

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      const suffix = params.toString() ? `?${params.toString()}` : "";

      const response = await fetch(`/api/admin/users${suffix}`, { method: "GET" });
      const payload = (await response.json()) as UsersResponse;

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to fetch users");
      }

      setUsers(payload.data ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  async function updateUser(
    userId: string,
    payload: { role?: UserRole; isActive?: boolean },
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
        throw new Error(body.error?.message ?? "Failed to update user");
      }

      setUsers((current) =>
        current.map((entry) => (entry.id === userId ? body.data! : entry)),
      );
      toast.success("User updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message);
    } finally {
      setActiveUserId(null);
    }
  }

  async function deleteUser(userId: string) {
    const confirmed = window.confirm("Delete this user account permanently?");
    if (!confirmed) return;

    setActiveUserId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const body = (await response.json()) as DeleteUserResponse;
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? "Failed to delete user");
      }

      setUsers((current) => current.filter((entry) => entry.id !== userId));
      toast.success("User deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message);
    } finally {
      setActiveUserId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter(
      (entry) =>
        entry.name.toLowerCase().includes(normalized) ||
        entry.email.toLowerCase().includes(normalized),
    );
  }, [users, query]);

  const metrics = useMemo(() => {
    const active = users.filter((entry) => entry.isActive).length;
    const admins = users.filter((entry) => entry.role === "admin").length;
    const managers = users.filter((entry) => entry.role === "manager").length;
    return { active, admins, managers };
  }, [users]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <Card className="notion-surface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiShieldUserLine />
            Admin Control Center
          </CardTitle>
          <CardDescription>
            Manage roles, account status, and audit user access in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Link href="/" className="inline-flex">
            <Button variant="outline">Home</Button>
          </Link>
          <Link href="/tasks" className="inline-flex">
            <Button variant="outline">Tasks</Button>
          </Link>
          <Button variant="outline" onClick={() => void fetchUsers()}>
            <RiRefreshLine data-icon="inline-start" />
            Refresh
          </Button>
          <div className="ml-auto">
            <LogoutButton variant="secondary" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{users.length}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Active Users</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{metrics.active}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Admins / Managers</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {metrics.admins} / {metrics.managers}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiUserSettingsLine />
            Users
          </CardTitle>
          <CardDescription>Filter, inspect, and update account permissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search by name or email..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="max-w-sm"
            />
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Role Filter</span>
              <select
                className="h-7 rounded-md border bg-input/20 px-2 text-xs"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as "" | UserRole)}
              >
                <option value="">All</option>
                {userRoleValues.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isLoading ? (
            <SectionLoader label="Loading users..." />
          ) : filteredUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No users match current filters.</p>
          ) : (
            <div className="grid gap-3">
              {filteredUsers.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-xl border bg-background p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{entry.name}</h3>
                      <p className="text-xs text-muted-foreground">{entry.email}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Created: {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.isActive ? "default" : "secondary"}>
                        {entry.isActive ? "active" : "inactive"}
                      </Badge>
                      <Badge variant="outline">{entry.role}</Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-xs">
                      <span className="mb-1 block text-muted-foreground">Role</span>
                      <select
                        className="h-7 rounded-md border bg-input/20 px-2 text-xs"
                        value={entry.role}
                        onChange={(event) =>
                          void updateUser(entry.id, {
                            role: event.target.value as UserRole,
                          })
                        }
                        disabled={activeUserId === entry.id}
                      >
                        {userRoleValues.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      variant={entry.isActive ? "destructive" : "outline"}
                      onClick={() =>
                        void updateUser(entry.id, {
                          isActive: !entry.isActive,
                        })
                      }
                      disabled={activeUserId === entry.id}
                    >
                      {entry.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void deleteUser(entry.id)}
                      disabled={activeUserId === entry.id}
                    >
                      Delete user
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
