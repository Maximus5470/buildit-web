import { parentPort, workerData } from "node:worker_threads";
import { eq } from "drizzle-orm";
import db from "@/db";
import { user, userGroupMembers } from "@/db/schema";
import { auth } from "@/lib/auth";

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

interface WorkerData {
  records: UserRecord[];
  groupCache: Record<string, string>; // Group Name -> Group ID
  workerIndex: number;
}

const { records, groupCache } = workerData as WorkerData;

async function processUsers() {
  let created = 0;
  let updated = 0;
  const errors: { email: string; error: unknown }[] = [];

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
          (error as { body?: { message?: string } }).body?.message?.includes(
            "already exists",
          )
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
      if (userId && record.UserGroup && groupCache[record.UserGroup]) {
        const groupId = groupCache[record.UserGroup];
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
    } catch (err: unknown) {
      errors.push({
        email: `${record.RollNo}@iare.ac.in`,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (parentPort) {
        parentPort.postMessage({ type: "progress", value: 1 });
      }
    }
  }

  if (parentPort) {
    parentPort.postMessage({ type: "done", errors, created, updated });
  }
}

processUsers().catch((err) => {
  if (parentPort) {
    parentPort.postMessage({ type: "fatal", error: err });
  }
  process.exit(1);
});
