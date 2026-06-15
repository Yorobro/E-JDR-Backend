import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MySqlContainer, StartedMySqlContainer } from "@testcontainers/mysql";
import mysql, { Pool, RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { resolve } from "node:path";
import { runMigrations } from "../../db/migrationRunner";

const TABLES = [
  "users",
  "credentials",
  "refresh_tokens",
  "campaigns",
  "character_sheets",
  "campaign_characters",
];

/** Normalise un DDL MySQL pour comparaison (espaces, AUTO_INCREMENT, ordre stable). */
function normalize(ddl: string): string {
  return ddl
    .replace(/AUTO_INCREMENT=\d+\s*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/ ,/g, ",")
    .trim();
}

async function showCreate(pool: Pool, table: string): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${table}\``);
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`Table introuvable : ${table}`);
  }
  return normalize(row["Create Table"] as string);
}

describe("Équivalence schéma baseline Drizzle vs migrations .sql historiques", () => {
  let umzugContainer: StartedMySqlContainer;
  let drizzleContainer: StartedMySqlContainer;
  let umzugPool: Pool;
  let drizzlePool: Pool;

  beforeAll(async () => {
    umzugContainer = await new MySqlContainer("mysql:8.4")
      .withDatabase("e_jdr")
      .withRootPassword("test")
      .start();
    drizzleContainer = await new MySqlContainer("mysql:8.4")
      .withDatabase("e_jdr")
      .withRootPassword("test")
      .start();

    umzugPool = mysql.createPool({
      host: umzugContainer.getHost(),
      port: umzugContainer.getPort(),
      user: "root",
      password: "test",
      database: "e_jdr",
      multipleStatements: true,
    });
    await runMigrations(umzugPool);

    drizzlePool = mysql.createPool({
      host: drizzleContainer.getHost(),
      port: drizzleContainer.getPort(),
      user: "root",
      password: "test",
      database: "e_jdr",
      multipleStatements: true,
    });
    await migrate(drizzle(drizzlePool), {
      migrationsFolder: resolve(
        __dirname,
        "../../src/infrastructure/persistence/drizzle/migrations",
      ),
    });
  }, 180_000);

  afterAll(async () => {
    await umzugPool?.end().catch(() => {});
    await drizzlePool?.end().catch(() => {});
    await umzugContainer?.stop().catch(() => {});
    await drizzleContainer?.stop().catch(() => {});
  });

  it.each(TABLES)("table %s a un DDL équivalent", async (table) => {
    const umzugDdl = await showCreate(umzugPool, table);
    const drizzleDdl = await showCreate(drizzlePool, table);
    expect(drizzleDdl).toBe(umzugDdl);
  });
});
