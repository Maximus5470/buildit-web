import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import db from "@/db";
import { user, userGroupMembers, userGroups } from "@/db/schema";
import { auth } from "@/lib/auth";

const CSV_FILE = path.join(process.cwd(), "data/pat_users/users.csv");

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

async function seedUsers() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV file not found at ${CSV_FILE}`);
    console.log(`Expected path: ${CSV_FILE}`);
    console.log("Please ensure the CSV file exists at this location.");
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_FILE, "utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as UserRecord[];

  console.log(`Found ${records.length} user records to process.`);

  // 1. Manage User Groups
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
          description: "Imported from CSV seed script",
        })
        .returning();
      groupCache.set(groupName, newGroup.id);
      console.log(`✅ Created new group: ${groupName}`);
    }
  }

  // 2. Process Users
  console.log("\n🚀 Processing users...");
  let processed = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const rollNo = record.RollNo;
      const dobStr = record["D.O.B"];
      const [day, month, year] = dobStr.split("-");
      const password = `${day}${month}${year}`; // ddMMyyyy
      const dobDate = new Date(`${year}-${month}-${day}`);
      const email = `${rollNo}@iare.ac.in`.toLowerCase();
      const role = "student";

      let userId: string | undefined;

      try {
        const res = await auth.api.signUpEmail({
          body: {
            name: record.FullName,
            email: email,
            password: password,
            username: rollNo,
            displayUsername: record.FullName.split(" ")[0],
          },
        });
        userId = res?.user?.id;

        // Update role and additional fields after user creation
        if (userId) {
          await db
            .update(user)
            .set({
              role: role as "student",
              branch: record.Branch,
              section: record.Section,
              dateOfBirth: dobDate,
              regulation: record.Regulation,
              semester: "6", // Default semester
              rollNumber: rollNo,
            })
            .where(eq(user.id, userId));
          created++;
        }
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "body" in error &&
          (error as any).body?.message?.includes("already exists")
        ) {
          // If user exists, fetch ID from DB and update fields
          const existingUser = await db.query.user.findFirst({
            where: eq(user.email, email),
          });
          userId = existingUser?.id;

          if (userId) {
            await db
              .update(user)
              .set({
                branch: record.Branch,
                section: record.Section,
                dateOfBirth: dobDate,
                regulation: record.Regulation,
                rollNumber: rollNo,
              })
              .where(eq(user.id, userId));
            updated++;
          }
        } else {
          throw error;
        }
      }

      // Add user to group if specified
      const groupName = record.UserGroup;
      if (userId && groupName && groupCache.has(groupName)) {
        const groupId = groupCache.get(groupName);
        if (groupId) {
          const isMember = await db.query.userGroupMembers.findFirst({
            where: (members, { and, eq }) =>
              and(eq(members.userId, userId), eq(members.groupId, groupId)),
          });

          if (!isMember) {
            await db.insert(userGroupMembers).values({
              userId,
              groupId,
            });
          }
        }
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${records.length} users...`);
      }
    } catch (err: unknown) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error processing ${record.RollNo}:`, msg);
    }
  }

  console.log(`\n✅ User seeding completed!`);
  console.log(`Total Processed: ${processed}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
