export const userRoleValues = ["user", "manager", "admin"] as const;

export type UserRole = (typeof userRoleValues)[number];

export function isUserRole(role: string | null | undefined): role is UserRole {
  return userRoleValues.includes(role as UserRole);
}

export function isAdmin(role: string | null | undefined): role is "admin" {
  return role === "admin";
}

export function isManager(role: string | null | undefined): role is "manager" {
  return role === "manager";
}
