import { relations } from "drizzle-orm";
import { date, pgTable, uuid } from "drizzle-orm/pg-core";
import { questions } from "./problems";

export const dailyProblems = pgTable("daily_problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull().unique(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
});

export const dailyProblemsRelations = relations(dailyProblems, ({ one }) => ({
  question: one(questions, {
    fields: [dailyProblems.questionId],
    references: [questions.id],
  }),
}));
