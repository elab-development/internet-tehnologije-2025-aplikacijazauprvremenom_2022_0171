import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TasksPageClient } from "@/components/tasks-page-client";
import { db } from "@/db";
import { categories, todoLists, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin, isManager, isUserRole, type UserRole } from "@/lib/roles";

export default async function TasksPage() {
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

  const actorRole: UserRole = isUserRole(currentUser?.role) ? currentUser.role : "user";
  const isManagerActor = isManager(actorRole);

  const [lists, userCategories, managerTeamMembers] = await Promise.all([
    db
      .select({
        id: todoLists.id,
        title: todoLists.title,
        description: todoLists.description,
      })
      .from(todoLists)
      .where(eq(todoLists.userId, session.user.id))
      .orderBy(asc(todoLists.createdAt)),
    db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
      })
      .from(categories)
      .where(eq(categories.userId, session.user.id))
      .orderBy(asc(categories.name)),
    isManagerActor
      ? db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            isActive: user.isActive,
          })
          .from(user)
          .where(and(eq(user.managerId, session.user.id), eq(user.role, "user")))
          .orderBy(asc(user.name))
      : Promise.resolve<Array<{ id: string; name: string; email: string; isActive: boolean }>>([]),
  ]);

  return (
    <TasksPageClient
      lists={lists}
      categories={userCategories}
      managerTeamMembers={managerTeamMembers}
      canAccessAdmin={isAdmin(actorRole)}
      sessionUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: actorRole,
      }}
    />
  );
}
