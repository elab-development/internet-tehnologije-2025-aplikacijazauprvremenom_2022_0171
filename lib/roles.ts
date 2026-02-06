export const userRoleValues = ["user", "manager", "admin"] as const;

export type UserRole = (typeof userRoleValues)[number];

export function isAdmin(role: string | null | undefined): role is "admin" {
  return role === "admin";
}
