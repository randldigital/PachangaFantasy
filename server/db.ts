import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import { env } from "./env";

const testSchema = process.env.TEST_SCHEMA || "pachanga_test";
if (env.NODE_ENV === "test" && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(testSchema)) {
  throw new Error(`Unsafe TEST_SCHEMA: ${testSchema}`);
}

const client = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  ...(env.NODE_ENV === "test"
    ? { connection: { options: `-c search_path=${testSchema}` } }
    : {}),
});

export const db = drizzle(client, { schema });
export const sqlClient = client;

export async function closeDatabase() {
  await client.end();
}
