import { eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

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

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Time Manager</CardTitle>
          <CardDescription>
            Welcome, {session.user.name}. Your role is{" "}
            <span className="font-medium">{currentUser?.role ?? "user"}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/tasks">
            <Button>Open Tasks</Button>
          </Link>
          {isAdmin(currentUser?.role) ? (
            <Link href="/admin">
              <Button variant="outline">Open Admin</Button>
            </Link>
          ) : null}
          <LogoutButton variant="secondary" />
        </CardContent>
      </Card>
    </main>
  );
}
