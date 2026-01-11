import { inArray } from "drizzle-orm";
import db from "@/db";
import {
  collectionQuestions,
  exams,
  questionCollections,
  questions,
  questionTestCases,
  user,
} from "@/db/schema";

// Types derived from schema or usage

// Sample problems data
const seedProblems = [
  {
    title: "Two Sum",
    description:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    difficulty: "easy" as const,
    driverCode: {
      java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Your code here\n    }\n}",
    },
    testCases: [
      { input: "[2,7,11,15]\n9", expectedOutput: "[0,1]", isHidden: false },
      { input: "[3,2,4]\n6", expectedOutput: "[1,2]", isHidden: true },
    ],
  },
  {
    title: "Reverse Linked List",
    description:
      "Given the head of a singly linked list, reverse the list, and return the reversed list.",
    difficulty: "easy" as const,
    driverCode: {
      java: "class Solution {\n    public ListNode reverseList(ListNode head) {\n        // Your code here\n    }\n}",
    },
    testCases: [
      { input: "[1,2,3,4,5]", expectedOutput: "[5,4,3,2,1]", isHidden: false },
      { input: "[1,2]", expectedOutput: "[2,1]", isHidden: true },
    ],
  },
  {
    title: "Valid Parentheses",
    description:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    difficulty: "medium" as const,
    driverCode: {
      java: "class Solution {\n    public boolean isValid(String s) {\n        // Your code here\n    }\n}",
    },
    testCases: [
      { input: "()", expectedOutput: "true", isHidden: false },
      { input: "()[]{}", expectedOutput: "true", isHidden: false },
      { input: "(]", expectedOutput: "false", isHidden: true },
    ],
  },
  {
    title: "Binary Search",
    description:
      "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums.",
    difficulty: "easy" as const,
    driverCode: {
      java: "class Solution {\n    public int search(int[] nums, int target) {\n        // Your code here\n    }\n}",
    },
    testCases: [
      { input: "[-1,0,3,5,9,12]\n9", expectedOutput: "4", isHidden: false },
      { input: "[-1,0,3,5,9,12]\n2", expectedOutput: "-1", isHidden: true },
    ],
  },
  {
    title: "Merge Two Sorted Lists",
    description:
      "You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list.",
    difficulty: "medium" as const,
    driverCode: {
      java: "class Solution {\n    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {\n        // Your code here\n    }\n}",
    },
    testCases: [
      {
        input: "[1,2,4]\n[1,3,4]",
        expectedOutput: "[1,1,2,3,4,4]",
        isHidden: false,
      },
      { input: "[]\n[]", expectedOutput: "[]", isHidden: true },
    ],
  },
];

async function seedData() {
  console.log("🌱 Starting seed...");

  try {
    // 1. Fetch a creator user (Admin or Instructor)
    // We try to find 'admin' or 'instructor' seeded by users.ts
    const creator = await db.query.user.findFirst({
      where: inArray(user.role, ["admin", "instructor"]),
    });

    if (!creator) {
      console.error(
        "❌ No admin or instructor found. Please run 'npm run seed:users' first.",
      );
      process.exit(1);
    }
    console.log(`👤 Using creator: ${creator.username} (${creator.id})`);

    // 2. Clean existing data
    // Order matters for FK constraints:
    // questionTestCases -> questions, collectionQuestions -> questions/questionCollections
    // Note: examAssignments and assignmentSubmissions are handled separately
    console.log("🧹 Cleaning existing data...");
    await db.delete(questionTestCases);
    await db.delete(collectionQuestions);
    await db.delete(questions);
    await db.delete(questionCollections);
    console.log("✅ Data cleaned.");

    // 3. Create Collections
    console.log("📚 Creating collections...");
    const collectionData = [
      {
        title: "Standard Library",
        description: "Classic algorithmic problems.",
        tags: ["algorithms", "basics"],
      },
      {
        title: "Data Structures",
        description: "Arrays, Linked Lists, Trees, and Graphs.",
        tags: ["data-structures", "advanced"],
      },
      {
        title: "Algorithms",
        description: "Sorting, Searching, and Dynamic Programming.",
        tags: ["algorithms", "advanced"],
      },
    ];

    const insertedCollections = [];
    for (const c of collectionData) {
      const [inserted] = await db
        .insert(questionCollections)
        .values({
          title: c.title,
          description: c.description,
          tags: c.tags,
        })
        .returning();
      insertedCollections.push(inserted);
    }
    console.log(`✅ Created ${insertedCollections.length} collections.`);

    // 4. Create Questions & TestCases
    console.log("🧩 Creating questions and testcases...");
    const allQuestionIds: string[] = [];

    let questionIndex = 0;
    for (const prob of seedProblems) {
      // Assign to collections round-robin
      const col =
        insertedCollections[questionIndex % insertedCollections.length];

      // Create Question
      const [insertedQuestion] = await db
        .insert(questions)
        .values({
          title: prob.title,
          problemStatement: prob.description,
          difficulty: prob.difficulty,
          allowedLanguages: ["java"],
          driverCode: prob.driverCode,
        })
        .returning();

      allQuestionIds.push(insertedQuestion.id);

      // Link question to collection
      await db.insert(collectionQuestions).values({
        collectionId: col.id,
        questionId: insertedQuestion.id,
      });

      // Create TestCases
      const testCaseData = prob.testCases.map((tc) => ({
        questionId: insertedQuestion.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
      }));

      await db.insert(questionTestCases).values(testCaseData);
      questionIndex++;
    }

    console.log(
      `✅ Created ${allQuestionIds.length} questions with testcases.`,
    );

    // 5. Create Exams
    console.log("📝 Creating exams...");
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    // Adjust scenarios for 5 questions
    // Collections: 0 (Standard), 1 (DS), 2 (Algo)
    // Distribution:
    // Q0 -> Col 0
    // Q1 -> Col 1
    // Q2 -> Col 2
    // Q3 -> Col 0
    // Q4 -> Col 1

    const examScenarios = [
      // 2 Upcoming
      {
        title: "Midterm Exam (Upcoming 1)",
        startOffset: oneDay, // starts tomorrow
        endOffset: oneDay * 2,
        duration: 60,
        config: {
          strategy: "random_pool",
          collectionId: insertedCollections[0].id,
          count: 1, // Standard lib has 2 questions (0, 3)
        },
      },
      {
        title: "Final Exam (Upcoming 2)",
        startOffset: oneDay * 5,
        endOffset: oneDay * 6,
        duration: 120,
        config: { strategy: "fixed", problemIds: allQuestionIds.slice(0, 3) },
      },
      // 2 Completed
      {
        title: "Quiz 1 (Completed 1)",
        startOffset: -oneDay * 5,
        endOffset: -oneDay * 4,
        duration: 30,
        config: {
          strategy: "random_pool",
          collectionId: insertedCollections[1].id,
          count: 2, // DS has 2 questions (1, 4)
        },
      },
      {
        title: "Quiz 2 (Completed 2)",
        startOffset: -oneDay * 2,
        endOffset: -oneDay * 1,
        duration: 45,
        config: { strategy: "fixed", problemIds: allQuestionIds.slice(3, 5) },
      },
      // 3 Ongoing
      {
        title: "Weekly Contest (Ongoing 1)",
        startOffset: -oneDay, // started yesterday
        endOffset: oneDay, // ends tomorrow
        duration: 180,
        config: {
          strategy: "random_pool",
          collectionId: insertedCollections[2].id,
          count: 1, // Algo has 1 question (2)
        },
      },
      {
        title: "Pop Quiz (Ongoing 2)",
        startOffset: -1000 * 60 * 30, // started 30 mins ago
        endOffset: 1000 * 60 * 60, // ends in 1 hour
        duration: 45,
        config: { strategy: "fixed", problemIds: [allQuestionIds[0]] },
      },
      {
        title: "Entrance Exam (Ongoing 3)",
        startOffset: -1000 * 60 * 60 * 2, // started 2 hours ago
        endOffset: 1000 * 60 * 60 * 24, // ends tomorrow
        duration: 90,
        config: {
          strategy: "random_pool",
          collectionId: insertedCollections[0].id,
          count: 2,
        },
      },
    ];

    for (const s of examScenarios) {
      await db.insert(exams).values({
        title: s.title,
        startTime: new Date(now.getTime() + s.startOffset),
        endTime: new Date(now.getTime() + s.endOffset),
        durationMinutes: s.duration,
        config: s.config as import("@/types/exam-config").ExamConfig, // Cast to proper type used in prompt mapping
        createdBy: creator.id,
      });
    }
    console.log(`✅ Created ${examScenarios.length} exams.`);

    console.log("🎉 Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

seedData();
