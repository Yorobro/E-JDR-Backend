import { defineConfig } from "drizzle-kit";
import "dotenv/config";
import { resolveDbName } from "./db/resolveDbName";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/infrastructure/persistence/drizzle/schema/index.ts",
  out: "./src/infrastructure/persistence/drizzle/migrations",
  dbCredentials: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? "3306"),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    // Ignore un éventuel DB_NAME réservé (ex. « test » injecté par la plateforme) au profit d'e_jdr.
    database: resolveDbName(process.env.DB_NAME),
  },
});
