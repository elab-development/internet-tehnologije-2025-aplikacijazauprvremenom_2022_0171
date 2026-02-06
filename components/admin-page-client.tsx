"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function AdminPageClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<"" | UserRole>("");

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = roleFilter ? `?role=${roleFilter}` : "";
      const response = await fetch(`/api/admin/users${query}`, { method: "GET" });
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
      const updatedUser = body.data;
      if (!response.ok || !updatedUser) {
        throw new Error(body.error?.message ?? "Failed to update user");
      }

      setUsers((current) =>
        current.map((user) => (user.id === userId ? updatedUser : user)),
      );
      toast.success("User updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message);
    } finally {
      setActiveUserId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
          <CardDescription>
            Manage user roles and active status through protected admin routes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="border-input bg-input/20 hover:bg-input/50 inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium"
            >
              Home
            </Link>
            <Link
              href="/tasks"
              className="border-input bg-input/20 hover:bg-input/50 inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium"
            >
              Tasks
            </Link>
            <label className="ml-auto text-xs">
              <span className="text-muted-foreground mr-2">Role Filter</span>
              <select
                className="bg-input/20 border-input h-7 rounded-md border px-2 text-xs"
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as "" | UserRole)
                }
              >
                <option value="">All</option>
                {userRoleValues.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="outline" onClick={() => void fetchUsers()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>GET /api/admin/users + PATCH /api/admin/users/:id</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-xs">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-xs">No users found.</p>
          ) : (
            <div className="grid gap-3">
              {users.map((currentUser) => (
                <article key={currentUser.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{currentUser.name}</h3>
                      <p className="text-muted-foreground text-xs">{currentUser.email}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Created: {new Date(currentUser.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={currentUser.isActive ? "default" : "secondary"}>
                        {currentUser.isActive ? "active" : "inactive"}
                      </Badge>
                      <Badge variant="outline">{currentUser.role}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="text-xs">
                      <span className="text-muted-foreground mr-2">Role</span>
                      <select
                        className="bg-input/20 border-input h-7 rounded-md border px-2 text-xs"
                        value={currentUser.role}
                        onChange={(event) =>
                          void updateUser(currentUser.id, {
                            role: event.target.value as UserRole,
                          })
                        }
                        disabled={activeUserId === currentUser.id}
                      >
                        {userRoleValues.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      variant={currentUser.isActive ? "destructive" : "outline"}
                      onClick={() =>
                        void updateUser(currentUser.id, {
                          isActive: !currentUser.isActive,
                        })
                      }
                      disabled={activeUserId === currentUser.id}
                    >
                      {currentUser.isActive ? "Deactivate" : "Activate"}
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
