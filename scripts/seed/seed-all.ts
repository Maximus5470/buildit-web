import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import db from "@/db";
import {
  collectionQuestions,
  questionCollections,
  questions,
  questionTestCases,
  user,
  userGroupMembers,
  userGroups,
} from "@/db/schema";
import { auth } from "@/lib/auth";

const LEETCODE_DATA_DIR = path.join(process.cwd(), "data/leetcode");
const REFINED_DATA_FILE = path.join(
  process.cwd(),
  "data/leetcode/refined_problem_data.json",
);
const CSV_FILE = path.join(process.cwd(), "data/pat_users/users.csv");

interface RefinedProblem {
  title: string;
  description: string;
  driver_code: string;
  testcases: {
    input: string;
    expected_output: string;
    is_hidden: boolean;
  }[];
  slug: string;
}

interface LeetCodeProblem {
  title: string;
  description: string;
  difficulty?: string;
  allowedLanguages?: string[];
  driverCode?: Record<string, string>;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
  }>;
}

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
  console.log("👥 Seeding users...");

  const createdUsers: (typeof user.$inferSelect)[] = [];

  // First, create admin and instructor
  const systemUsers = [
    {
      email: "admin@buildit.com",
      name: "Admin User",
      password: "admin123",
      username: "admin",
      displayUsername: "Admin",
      image: "https://api.dicebear.com/9.x/glass/svg?seed=admin",
      role: "admin",
    },
    {
      email: "instructor@buildit.com",
      name: "John Instructor",
      password: "instructor123",
      username: "instructor",
      displayUsername: "Instructor",
      image: "https://api.dicebear.com/9.x/glass/svg?seed=instructor",
      role: "instructor",
    },
  ];

  for (const u of systemUsers) {
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, u.email),
    });

    if (existingUser) {
      console.log(`  ${u.username} already exists`);
      createdUsers.push(existingUser);
      continue;
    }

    await auth.api.signUpEmail({
      body: {
        email: u.email,
        name: u.name,
        password: u.password,
        username: u.username,
        displayUsername: u.displayUsername,
        image: u.image,
      },
    });

    const newUser = await db.query.user.findFirst({
      where: eq(user.email, u.email),
    });

    if (newUser) {
      await db
        .update(user)
        .set({ role: u.role as "student" | "instructor" | "admin" })
        .where(eq(user.id, newUser.id));

      const updatedUser = await db.query.user.findFirst({
        where: eq(user.id, newUser.id),
      });

      if (updatedUser) createdUsers.push(updatedUser);
      console.log(`  ✓ Created ${u.username} (${u.role})`);
    }
  }

  // Load and create users from CSV
  if (fs.existsSync(CSV_FILE)) {
    console.log(`  Loading users from CSV: ${path.basename(CSV_FILE)}`);

    const content = fs.readFileSync(CSV_FILE, "utf-8");
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as UserRecord[];

    console.log(`  Found ${records.length} student records`);

    // Create user groups from CSV first
    const uniqueGroups = Array.from(
      new Set(records.map((r) => r.UserGroup).filter(Boolean)),
    );

    for (const groupName of uniqueGroups) {
      const existing = await db.query.userGroups.findFirst({
        where: eq(userGroups.name, groupName),
      });

      if (!existing) {
        await db.insert(userGroups).values({
          name: groupName,
          description: `Group for ${groupName} students`,
        });
      }
    }

    // Create students from CSV
    let csvCreated = 0;
    let csvSkipped = 0;

    for (const record of records) {
      const rollNo = record.RollNo;
      const dobStr = record["D.O.B"];
      const [day, month, year] = dobStr.split("-");
      const password = `${day}${month}${year}`;
      const email = `${rollNo}@iare.ac.in`.toLowerCase();

      const existingUser = await db.query.user.findFirst({
        where: eq(user.email, email),
      });

      if (existingUser) {
        csvSkipped++;
        createdUsers.push(existingUser);
        continue;
      }

      try {
        await auth.api.signUpEmail({
          body: {
            name: record.FullName,
            email: email,
            password: password,
            username: rollNo,
            displayUsername: record.FullName.split(" ")[0],
          },
        });

        const newUser = await db.query.user.findFirst({
          where: eq(user.email, email),
        });

        if (newUser) {
          await db
            .update(user)
            .set({ role: "student" })
            .where(eq(user.id, newUser.id));

          // Add to user group
          const group = await db.query.userGroups.findFirst({
            where: eq(userGroups.name, record.UserGroup),
          });

          if (group) {
            await db.insert(userGroupMembers).values({
              groupId: group.id,
              userId: newUser.id,
            });
          }

          const updatedUser = await db.query.user.findFirst({
            where: eq(user.id, newUser.id),
          });

          if (updatedUser) createdUsers.push(updatedUser);
          csvCreated++;
        }
      } catch (error) {
        console.error(`    Error creating user ${rollNo}:`, error);
      }
    }

    console.log(
      `  ✓ Created ${csvCreated} students from CSV (${csvSkipped} already existed)`,
    );
  } else {
    console.log(`  CSV file not found at ${CSV_FILE}, skipping student import`);
  }

  console.log(`✅ Seeded ${createdUsers.length} total users\n`);
  return createdUsers;
}

async function seedGroups(users: (typeof user.$inferSelect)[]) {
  console.log("👥 Checking additional user groups...");

  const students = users.filter((u) => u.role === "student");

  if (students.length === 0) {
    console.log("  No students found, skipping additional groups\n");
    return [];
  }

  // Most groups should already be created from CSV, just verify
  const allGroups = await db.query.userGroups.findMany();
  console.log(`✅ Found ${allGroups.length} total user groups\n`);
  return allGroups;
}

async function seedAll() {
  console.log("🌱 Starting comprehensive database seeding...\n");
  console.log(`${"=".repeat(60)}\n`);

  // Step 1: Seed Users
  const users = await seedUsers();

  const adminUser = users.find((u) => u.role === "admin");
  const instructorUser = users.find((u) => u.role === "instructor");
  const createdBy = adminUser?.id || instructorUser?.id || users[0]?.id;

  if (!createdBy) {
    console.error("❌ No users created, cannot continue");
    process.exit(1);
  }

  // Step 2: Seed Groups
  await seedGroups(users);

  // Step 3: Seed Questions
  console.log("📦 Seeding questions and question collections...\n");

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalLinksCreated = 0;

  // ==================== LEETCODE BATCH FILES ====================
  console.log("  📦 Part 1: Processing LeetCode batch files...");

  const leetcodeCollectionTitle = "LeetCode Problems";
  let leetcodeCollection = await db.query.questionCollections.findFirst({
    where: eq(questionCollections.title, leetcodeCollectionTitle),
  });

  if (!leetcodeCollection) {
    console.log(`    Creating collection: "${leetcodeCollectionTitle}"...`);
    const [newCollection] = await db
      .insert(questionCollections)
      .values({
        title: leetcodeCollectionTitle,
        description: "Collection of imported LeetCode problems",
        tags: ["leetcode", "dsa", "practice"],
      })
      .returning();
    leetcodeCollection = newCollection;
  } else {
    console.log(`    Using existing collection: "${leetcodeCollectionTitle}"`);
  }

  const batchFiles = fs
    .readdirSync(LEETCODE_DATA_DIR)
    .filter((file) => file.endsWith(".json") && file.startsWith("batch_"));

  if (batchFiles.length > 0) {
    console.log(`Found ${batchFiles.length} batch files.`);

    for (const file of batchFiles) {
      console.log(`  Processing ${file}...`);
      const filePath = path.join(LEETCODE_DATA_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const problems: LeetCodeProblem[] = JSON.parse(content);

      for (const problem of problems) {
        totalProcessed++;
        try {
          let questionId: string;

          const existingQuestion = await db.query.questions.findFirst({
            where: (q, { eq }) => eq(q.title, problem.title),
          });

          if (existingQuestion) {
            questionId = existingQuestion.id;

            // Check and update driverCode if needed
            const currentDriverCode = existingQuestion.driverCode as Record<
              string,
              string
            >;
            const newDriverCode = problem.driverCode as Record<string, string>;

            if (
              JSON.stringify(currentDriverCode) !==
              JSON.stringify(newDriverCode)
            ) {
              await db
                .update(questions)
                .set({
                  driverCode: problem.driverCode,
                })
                .where(eq(questions.id, questionId));
            }
          } else {
            const [newQuestion] = await db
              .insert(questions)
              .values({
                title: problem.title,
                problemStatement: problem.description,
                difficulty: (problem.difficulty || "medium") as
                  | "easy"
                  | "medium"
                  | "hard",
                allowedLanguages: problem.allowedLanguages || [
                  "java",
                  "python",
                ],
                driverCode: problem.driverCode || { java: "", python: "" },
              })
              .returning();
            questionId = newQuestion.id;
            totalInserted++;

            // Insert Test Cases
            if (problem.testCases && problem.testCases.length > 0) {
              const testCasesToInsert = problem.testCases.map((tc) => ({
                questionId: questionId,
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isHidden: tc.isHidden !== undefined ? tc.isHidden : true,
              }));
              await db.insert(questionTestCases).values(testCasesToInsert);
            }
          }

          // Link to Collection
          const existingLink = await db.query.collectionQuestions.findFirst({
            where: (cq, { and, eq }) =>
              and(
                eq(cq.collectionId, leetcodeCollection.id),
                eq(cq.questionId, questionId),
              ),
          });

          if (!existingLink) {
            await db.insert(collectionQuestions).values({
              collectionId: leetcodeCollection.id,
              questionId: questionId,
            });
            totalLinksCreated++;
          }
        } catch (error) {
          console.error(
            `        Error processing question "${problem.title}":`,
            error,
          );
        }
      }
    }
    console.log(`    ✅ LeetCode batch files processed\n`);
  } else {
    console.log("    No batch files found, skipping...\n");
  }

  // ==================== REFINED PROBLEMS ====================
  console.log("  📦 Part 2: Processing refined Java practice problems...");

  if (fs.existsSync(REFINED_DATA_FILE)) {
    const refinedCollectionTitle = "Java Practice Problems";
    let refinedCollection = await db.query.questionCollections.findFirst({
      where: eq(questionCollections.title, refinedCollectionTitle),
    });

    if (!refinedCollection) {
      console.log(`    Creating collection: "${refinedCollectionTitle}"...`);
      const [newCollection] = await db
        .insert(questionCollections)
        .values({
          title: refinedCollectionTitle,
          description: "Collection of Java programming practice problems",
          tags: ["java", "practice", "basic"],
        })
        .returning();
      refinedCollection = newCollection;
    } else {
      console.log(`    Using existing collection: "${refinedCollectionTitle}"`);
    }

    const content = fs.readFileSync(REFINED_DATA_FILE, "utf-8");
    const refinedProblems: RefinedProblem[] = JSON.parse(content);

    console.log(`    Found ${refinedProblems.length} refined problems.`);

    for (const problem of refinedProblems) {
      totalProcessed++;
      try {
        let questionId: string;

        const existingQuestion = await db.query.questions.findFirst({
          where: (q, { eq }) => eq(q.title, problem.title),
        });

        if (existingQuestion) {
          questionId = existingQuestion.id;

          const currentDriverCode = existingQuestion.driverCode as Record<
            string,
            string
          >;
          const newDriverCode = problem.driver_code
            ? { java: problem.driver_code }
            : { java: "" };

          if (
            JSON.stringify(currentDriverCode) !== JSON.stringify(newDriverCode)
          ) {
            await db
              .update(questions)
              .set({
                driverCode: newDriverCode,
              })
              .where(eq(questions.id, questionId));
          }
        } else {
          const [newQuestion] = await db
            .insert(questions)
            .values({
              title: problem.title,
              problemStatement: problem.description,
              difficulty: "easy",
              allowedLanguages: ["java"],
              driverCode: problem.driver_code
                ? { java: problem.driver_code }
                : { java: "" },
            })
            .returning();
          questionId = newQuestion.id;
          totalInserted++;

          // Insert Test Cases
          if (problem.testcases && problem.testcases.length > 0) {
            const testCasesToInsert = problem.testcases.map((tc) => ({
              questionId: questionId,
              input: tc.input,
              expectedOutput: tc.expected_output,
              isHidden: tc.is_hidden !== undefined ? tc.is_hidden : true,
            }));
            await db.insert(questionTestCases).values(testCasesToInsert);
          }
        }

        // Link to Collection
        const existingLink = await db.query.collectionQuestions.findFirst({
          where: (cq, { and, eq }) =>
            and(
              eq(cq.collectionId, refinedCollection.id),
              eq(cq.questionId, questionId),
            ),
        });

        if (!existingLink) {
          await db.insert(collectionQuestions).values({
            collectionId: refinedCollection.id,
            questionId: questionId,
          });
          totalLinksCreated++;
        }
      } catch (error) {
        console.error(
          `    Error processing question "${problem.title}":`,
          error,
        );
      }
    }

    console.log(`    ✅ Refined problems processed\n`);
  } else {
    console.log(`    File not found: ${REFINED_DATA_FILE}, skipping...\n`);
  }

  // ==================== SUMMARY ====================
  console.log("=".repeat(60));
  console.log("✅ COMPREHENSIVE SEEDING COMPLETE!");
  console.log("=".repeat(60));
  console.log(`👥 Users: ${users.length}`);
  console.log(`📊 Questions Processed: ${totalProcessed}`);
  console.log(`✨ Questions Inserted: ${totalInserted}`);
  console.log(`🔗 Collection Links: ${totalLinksCreated}`);
  console.log("=".repeat(60));

  process.exit(0);
}

seedAll().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
