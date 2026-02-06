import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TasksPageClient } from "@/components/tasks-page-client";
import { db } from "@/db";
import { categories, todoLists, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

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

  const [lists, userCategories] = await Promise.all([
    db
      .select({
        id: todoLists.id,
        title: todoLists.title,
      })
      .from(todoLists)
      .where(eq(todoLists.userId, session.user.id))
      .orderBy(asc(todoLists.createdAt)),
    db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
      .where(eq(categories.userId, session.user.id))
      .orderBy(asc(categories.name)),
  ]);

  return (
    <TasksPageClient
      lists={lists}
      categories={userCategories}
      canAccessAdmin={isAdmin(currentUser?.role)}
    />
  );
}
