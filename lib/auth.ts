import { customSession } from "better-auth/plugins";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL!,
  basePath: "/api/auth",

  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  emailAndPassword: {
    enabled: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },

  plugins: [
    customSession(async ({ user: sessionUser, session }) => {
      const dbUser = await db.query.user.findFirst({
        where: (userTable, { eq }) => eq(userTable.id, sessionUser.id),
        columns: {
          role: true,
          isActive: true,
          managerId: true,
        },
      });

      return {
        user: {
          ...sessionUser,
          role: dbUser?.role ?? "user",
          isActive: dbUser?.isActive ?? false,
          managerId: dbUser?.managerId ?? null,
        },
        session,
      };
    }),
  ],
});
