import { sql } from "drizzle-orm";
import db from "../src/db";

async function dropAllTables() {
  console.log("Dropping all tables...");
  await db.execute(sql`DROP SCHEMA public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  console.log("All tables dropped! Schema recreated.");
  process.exit(0);
}

dropAllTables().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
