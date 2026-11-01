import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { NEON_SCHEMA_STATEMENTS } from "../server/_core/neonSchema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to apply the Neon PostgreSQL schema.");
}

const sql = neon(connectionString);
for (const statement of NEON_SCHEMA_STATEMENTS) {
  await sql.query(statement, []);
}

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;

console.log("Neon application schema is ready:", tables.map((row) => row.table_name).join(", "));
