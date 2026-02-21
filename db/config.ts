import { config as loadEnv } from "dotenv";

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Drizzle operations");
}

export const dbConfig = {
  schemaPath: "./db/schema.ts",
  migrationsDir: "./db/migrations",
  databaseUrl,
} as const;
