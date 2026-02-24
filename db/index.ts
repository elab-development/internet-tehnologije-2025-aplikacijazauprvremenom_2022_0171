import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let db;

if (process.env.NODE_ENV === "production") {
  const sql = neon(process.env.DATABASE_URL!);
  db = drizzleNeon(sql, { schema });
} else {
  db = drizzlePg(process.env.DATABASE_URL!, { schema });
}

export { db };