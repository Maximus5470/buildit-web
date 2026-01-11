import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import db from "@/db";
import {
  collectionQuestions,
  questionCollections,
  questions,
  questionTestCases,
} from "@/db/schema";

const DATA_FILE = path.join(
  process.cwd(),
  "data/leetcode/refined_problem_data.json",
);
const COLLECTION_TITLE = "Java Practice Problems";

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

async function seed() {
  console.log("🌱 Starting Refined Problems seeding process...");

  // 1. Check if file exists
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ File not found: ${DATA_FILE}`);
    process.exit(1);
  }

  // 2. Ensure Collection Exists
  let collection = await db.query.questionCollections.findFirst({
    where: eq(questionCollections.title, COLLECTION_TITLE),
  });

  if (!collection) {
    console.log(`Creating collection: "${COLLECTION_TITLE}"...`);
    const [newCollection] = await db
      .insert(questionCollections)
      .values({
        title: COLLECTION_TITLE,
        description: "Collection of Java programming practice problems",
        tags: ["java", "practice", "basic"],
      })
      .returning();
    collection = newCollection;
  } else {
    console.log(
      `Using existing collection: "${COLLECTION_TITLE}" (ID: ${collection.id})`,
    );
  }

  // 3. Read File
  const content = fs.readFileSync(DATA_FILE, "utf-8");
  const problems: RefinedProblem[] = JSON.parse(content);

  console.log(
    `Found ${problems.length} problems in refined_problem_data.json.`,
  );

  let totalQuestionsProcessed = 0;
  let totalQuestionsInserted = 0;
  let totalLinksCreated = 0;

  for (const problem of problems) {
    totalQuestionsProcessed++;
    try {
      let questionId: string;

      // Check if question exists by title (slug field doesn't exist in questions table)
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
        const newDriverCode = problem.driver_code
          ? { java: problem.driver_code }
          : { java: "" };

        if (
          JSON.stringify(currentDriverCode) !== JSON.stringify(newDriverCode)
        ) {
          console.log(`  Updating driverCode for "${problem.title}"...`);
          await db
            .update(questions)
            .set({
              driverCode: newDriverCode,
            })
            .where(eq(questions.id, questionId));
        }
      } else {
        // Insert Question
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
        totalQuestionsInserted++;

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
            eq(cq.collectionId, collection.id),
            eq(cq.questionId, questionId),
          ),
      });

      if (!existingLink) {
        await db.insert(collectionQuestions).values({
          collectionId: collection.id,
          questionId: questionId,
        });
        totalLinksCreated++;
      }
    } catch (error) {
      console.error(`  Error processing question "${problem.title}":`, error);
    }
  }

  console.log(`\n✅ Refined Problems seeding complete!`);
  console.log(`Total Processed: ${totalQuestionsProcessed}`);
  console.log(`New Questions Inserted: ${totalQuestionsInserted}`);
  console.log(`New Collection Links: ${totalLinksCreated}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
