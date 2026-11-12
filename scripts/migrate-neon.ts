import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to apply the Neon PostgreSQL schema.");
}

const migrationFiles = [
  "drizzle/neon/0001_application_schema.sql",
  "drizzle/neon/0002_control_room_roles.sql",
];

const sql = neon(connectionString);
for (const migrationFile of migrationFiles) {
  const migration = await readFile(resolve(process.cwd(), migrationFile), "utf8");
  const statements = migration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sql.query(statement, []);
  }
}

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;

console.log("Neon application schema is ready:", tables.map((row) => row.table_name).join(", "));
