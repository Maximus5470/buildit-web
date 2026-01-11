import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";

const DEFAULT_PASSWORD = "password1234";
const CSV_DIRECTORY = join(process.cwd(), "data", "csv");

async function generateAvatar(seed: string): Promise<string> {
  return `https://api.dicebear.com/9.x/glass/svg?seed=${seed}`;
}

async function processStudentsCSV(filePath: string) {
  console.log(`\nProcessing students CSV: ${filePath}`);

  const fileContent = await readFile(filePath, "utf-8");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  let successCount = 0;
  let skipCount = 0;

  for (const record of records) {
    // Helper to find value from multiple potential column names
    const getValue = (keys: string[]) => {
      const recordKeys = Object.keys(record);
      for (const key of keys) {
        const foundKey = recordKeys.find(
          (k) =>
            k.toLowerCase().replace(/[^a-z0-9]/g, "") ===
            key.toLowerCase().replace(/[^a-z0-9]/g, ""),
        );
        if (foundKey && record[foundKey]) return record[foundKey];
      }
      return "";
    };

    const rollNumber = getValue(["rollNumber", "rollNo", "roll no", "roll_no"]);
    const name = getValue(["name", "studentName", "student name", "student"]);
    let email = getValue(["email", "e-mail", "mail"]);
    const dobRaw = getValue([
      "dateOfBirth",
      "dob",
      "d.o.b",
      "date of birth",
      "D.O.B",
    ]);
    const semester = getValue(["semester", "sem"]);
    const section = getValue(["section", "sec"]);
    const branch = getValue(["branch"]);
    const regulation = getValue(["regulation", "Regulation"]);
    let username = getValue(["username", "user name"]);

    // Defaults and logical fallbacks
    if (!email && rollNumber) {
      email = `${rollNumber}@iare.ac.in`;
    }
    if (!username) {
      username = rollNumber || name.replace(/\s+/g, "").toLowerCase();
    }

    if (!email || !name) {
      console.log(
        `⚠️  Skipping invalid row (missing email/unique ID or name): ${JSON.stringify(
          record,
        )}`,
      );
      skipCount++;
      continue;
    }

    // Parse Date (Handle DD-MM-YYYY)
    let dob: Date | null = null;
    if (dobRaw) {
      if (dobRaw.includes("-") && dobRaw.split("-")[0].length === 2) {
        const [day, month, year] = dobRaw.split("-");
        dob = new Date(`${year}-${month}-${day}`);
      } else {
        dob = new Date(dobRaw);
      }
    }

    try {
      const existingUser = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (existingUser) {
        console.log(
          `  User ${username} (${email}) already exists, updating data...`,
        );
        await db
          .update(user)
          .set({
            role: "student",
            rollNumber: rollNumber || existingUser.rollNumber,
            dateOfBirth: dob || existingUser.dateOfBirth,
            semester: semester || existingUser.semester,
            section: section || existingUser.section,
            branch: branch || existingUser.branch,
          })
          .where(eq(user.id, existingUser.id));
        successCount++;
        continue;
      }

      const displayUsername = name.split(" ")[0]; // First name as display name
      const image = await generateAvatar(username);

      let password = DEFAULT_PASSWORD;
      if (dob && !Number.isNaN(dob.getTime())) {
        const d = String(dob.getDate()).padStart(2, "0");
        const m = String(dob.getMonth() + 1).padStart(2, "0");
        const y = dob.getFullYear();
        password = `${d}${m}${y}`;
      }

      await auth.api.signUpEmail({
        body: {
          email,
          name,
          password,
          username,
          displayUsername,
          image,
        },
      });

      // Update role and additional fields after creation
      await db
        .update(user)
        .set({
          role: "student",
          rollNumber: rollNumber,
          dateOfBirth: dob,
          semester: semester,
          section: section,
          branch: branch,
          regulation: regulation,
        })
        .where(eq(user.email, email));

      console.log(`✓ Student ${username} created successfully`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error creating student ${username}:`, error);
    }
  }

  console.log(
    `\nStudents Summary: ${successCount} processed (created/updated), ${skipCount} skipped`,
  );
}

async function processInstructorsCSV(filePath: string) {
  console.log(`\nProcessing instructors CSV: ${filePath}`);

  const fileContent = await readFile(filePath, "utf-8");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  let successCount = 0;
  let skipCount = 0;

  for (const record of records) {
    // Helper to find value from multiple potential column names
    const getValue = (keys: string[]) => {
      const recordKeys = Object.keys(record);
      for (const key of keys) {
        const foundKey = recordKeys.find(
          (k) =>
            k.toLowerCase().replace(/[^a-z0-9]/g, "") ===
            key.toLowerCase().replace(/[^a-z0-9]/g, ""),
        );
        if (foundKey && record[foundKey]) return record[foundKey];
      }
      return "";
    };

    const name = getValue(["name", "instructorName", "instructor name"]);
    const email = getValue(["email", "e-mail", "mail"]);
    let username = getValue(["username"]);

    if (!username) {
      username = name.replace(/\s+/g, "").toLowerCase().substring(0, 20);
    }

    if (!email || !name) {
      console.log(`⚠️  Skipping invalid row: ${JSON.stringify(record)}`);
      skipCount++;
      continue;
    }

    try {
      const existingUser = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (existingUser) {
        console.log(`  User ${username} already exists, updating data...`);
        await db
          .update(user)
          .set({
            role: "instructor",
          })
          .where(eq(user.id, existingUser.id));
        successCount++;
        continue;
      }

      const displayUsername = name.split(" ")[0];
      const image = await generateAvatar(username);

      await auth.api.signUpEmail({
        body: {
          email,
          name,
          password: DEFAULT_PASSWORD,
          username,
          displayUsername,
          image,
        },
      });

      // Update role and additional fields after creation
      await db
        .update(user)
        .set({
          role: "instructor",
        })
        .where(eq(user.email, email));

      console.log(`✓ Instructor ${username} created successfully`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error creating instructor ${username}:`, error);
    }
  }

  console.log(
    `\nInstructors Summary: ${successCount} created, ${skipCount} skipped`,
  );
}

async function seedFromCSV() {
  console.log("=".repeat(60));
  console.log("Starting CSV User Seeding");
  console.log("=".repeat(60));
  console.log(`CSV Directory: ${CSV_DIRECTORY}`);
  console.log(`Default Password: ${DEFAULT_PASSWORD}`);
  console.log("=".repeat(60));

  try {
    const files = await readdir(CSV_DIRECTORY);
    const csvFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".csv"),
    );

    if (csvFiles.length === 0) {
      console.log(`\n⚠️  No CSV files found in ${CSV_DIRECTORY}`);
      return;
    }

    console.log(
      `\nFound ${csvFiles.length} CSV file(s):\n${csvFiles
        .map((f) => `  - ${f}`)
        .join("\n")}`,
    );

    for (const file of csvFiles) {
      const filePath = join(CSV_DIRECTORY, file);
      const fileName = file.toLowerCase();

      // Flexible filename matching
      if (fileName.includes("student") || fileName.includes("aero")) {
        await processStudentsCSV(filePath);
      } else if (
        fileName.includes("instructor") ||
        fileName.includes("teacher")
      ) {
        await processInstructorsCSV(filePath);
      } else {
        console.log(
          `\n⚠️  Skipping ${file} - filename should contain 'student' or 'instructor' (or 'aero' etc for students)`,
        );
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("CSV Seeding completed successfully!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error during CSV seeding:", error);
    throw error;
  }
}

async function main() {
  await seedFromCSV();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
