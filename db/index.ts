import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const db = drizzleNeon(neon(process.env.DATABASE_URL!), { schema })

export { db };
