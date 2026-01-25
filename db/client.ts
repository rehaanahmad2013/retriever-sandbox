import { drizzle } from "drizzle-orm/node-postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL required");
}

console.info("Connecting to database...");

export const db = drizzle({
  casing: "snake_case",
  connection: {
    connectionString: process.env.DATABASE_URL,
  },
});
