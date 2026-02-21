import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "../config/index.ts";

const connectionString = config.supabase.dbUrl;

export const sqlClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sqlClient);
