import { sql } from "drizzle-orm";
import { db } from "../client";

async function main() {
  console.log("Enabling pgvector extension...");

  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("✓ pgvector extension enabled successfully");
  } catch (error) {
    console.error("❌ Failed to enable pgvector extension:", error);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
