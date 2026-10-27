import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only compares the schema with migration files; it does
// not connect to the database. Keep DATABASE_URL optional at config-load time
// so schema generation can run in CI/build environments without DB secrets.
// Commands that connect to MySQL (migrate, push, studio) still require it.
const connectionString = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  ...(connectionString
    ? {
        dbCredentials: {
          url: connectionString,
        },
      }
    : {}),
});
