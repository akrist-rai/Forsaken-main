import type { Config } from "drizzle-kit";
import { dbConfig } from "./db/config.ts";

export default {
  schema: dbConfig.schemaPath,
  out: dbConfig.migrationsDir,
  dialect: "postgresql",
  dbCredentials: {
    url: dbConfig.databaseUrl,
  },
} satisfies Config;
