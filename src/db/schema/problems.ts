import { relations } from "drizzle-orm";
import {
  boolean,
  json,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { difficulty, problemType } from "./enums";

// DEPRECATED: Old collections and problems tables - use questions instead
// Kept for backward compatibility, will be removed after migration

// Modern question-based tables
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  problemStatement: text("problem_statement").notNull(),
  difficulty: difficulty("difficulty").notNull(),
  allowedLanguages: json("allowed_languages").default(["java"]),
  driverCode: json("driver_code")
    .$type<Record<string, string>>()
    .default({ java: "" }),
});

export const questionTestCases = pgTable("question_test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  isHidden: boolean("is_hidden").default(true).notNull(),
});

// Relations
export const questionsRelations = relations(questions, ({ many }) => ({
  testCases: many(questionTestCases),
}));

export const questionTestCasesRelations = relations(
  questionTestCases,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionTestCases.questionId],
      references: [questions.id],
    }),
  }),
);

// Restored Legacy Tables
export const problems = pgTable("problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: problemType("type").notNull(),
  difficulty: difficulty("difficulty").notNull(),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description").notNull(),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  driverCode: jsonb("driver_code").$type<Record<string, string>>(),
  gradingMetadata: jsonb("grading_metadata").$type<Record<string, unknown>>(),
  public: boolean("public").default(true).notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const testCases = pgTable("test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  problemId: uuid("problem_id")
    .notNull()
    .references(() => problems.id, { onDelete: "cascade" }),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  isHidden: boolean("is_hidden").default(true).notNull(),
});

export const problemsRelations = relations(problems, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [problems.createdBy],
    references: [user.id],
  }),
  testCases: many(testCases),
}));

export const testCasesRelations = relations(testCases, ({ one }) => ({
  problem: one(problems, {
    fields: [testCases.problemId],
    references: [problems.id],
  }),
}));
