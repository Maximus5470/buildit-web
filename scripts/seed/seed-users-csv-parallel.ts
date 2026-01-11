import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import db from "@/db";
import { userGroups } from "@/db/schema/groups";

const CSV_FILE = path.join(process.cwd(), "data/pat_users/users.csv");
const WORKER_SCRIPT = path.join(__dirname, "seed-users-csv.worker.ts");

interface UserRecord {
  Sno: string;
  RollNo: string;
  Branch: string;
  FullName: string;
  Section: string;
  Gender: string;
  "D.O.B": string;
  Regulation: string;
  UserGroup: string;
}

// Helper to chunk array
function chunkArray<T>(array: T[], chunks: number): T[][] {
  const result: T[][] = [];
  const chunkSize = Math.ceil(array.length / chunks);
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

async function seedUsers() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV file not found at ${CSV_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_FILE, "utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as UserRecord[];

  console.log(`Found ${records.length} user records to process.`);

  // 1. Manage User Groups (Main Thread)
  const uniqueGroups = Array.from(
    new Set(records.map((r) => r.UserGroup).filter(Boolean)),
  );
  const groupCache = new Map<string, string>(); // Name -> ID

  console.log(`Checking ${uniqueGroups.length} user groups...`);

  for (const groupName of uniqueGroups) {
    const existing = await db.query.userGroups.findFirst({
      where: eq(userGroups.name, groupName),
    });

    if (existing) {
      groupCache.set(groupName, existing.id);
    } else {
      const [newGroup] = await db
        .insert(userGroups)
        .values({
          name: groupName,
          description: "Imported from seed script",
        })
        .returning();
      groupCache.set(groupName, newGroup.id);
      console.log(`Created new group: ${groupName}`);
    }
  }

  // 2. Spawn Workers
  const numCPUs = Math.min(os.cpus().length, 4); // Limit to 4 workers max
  console.log(`🚀 Spawning ${numCPUs} workers to process users...`);

  const chunks = chunkArray(records, numCPUs);

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  const workers = chunks.map((chunk, index) => {
    return new Promise<void>((resolve, reject) => {
      // Skip empty chunks
      if (chunk.length === 0) {
        resolve();
        return;
      }

      const worker = new Worker(WORKER_SCRIPT, {
        workerData: {
          records: chunk,
          groupCache: Object.fromEntries(groupCache), // Convert Map to Object for serialization
          workerIndex: index,
        },
        // Important for running TS worker with tsx
        execArgv: ["--import", "tsx/esm"],
      });

      worker.on("message", (msg) => {
        if (msg.type === "progress") {
          totalProcessed++;
          if (totalProcessed % 50 === 0 || totalProcessed === records.length) {
            console.log(
              `Progress: ${totalProcessed}/${records.length} users processed...`,
            );
          }
        } else if (msg.type === "done") {
          totalCreated += msg.created || 0;
          totalUpdated += msg.updated || 0;
          totalErrors += msg.errors?.length || 0;

          if (msg.errors && msg.errors.length > 0) {
            console.error(
              `Worker ${index} encountered ${msg.errors.length} errors`,
            );
          }
          resolve();
        } else if (msg.type === "fatal") {
          reject(msg.error);
        }
      });

      worker.on("error", (err) => {
        reject(err);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        } else {
          resolve();
        }
      });
    });
  });

  try {
    await Promise.all(workers);
    console.log("\n✅ User seeding completed! All workers finished.");
    console.log(`Total Processed: ${totalProcessed}`);
    console.log(`Created: ${totalCreated}`);
    console.log(`Updated: ${totalUpdated}`);
    console.log(`Errors: ${totalErrors}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ A worker failed:", err);
    process.exit(1);
  }
}

seedUsers().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
