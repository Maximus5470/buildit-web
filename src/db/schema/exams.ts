import { relations } from "drizzle-orm";
import {
  foreignKey,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import {
  examStatusEnum,
  gradingStrategyEnum,
  strategyTypeEnum,
} from "./enums";
import { userGroups } from "./groups";
import { problems } from "./problems";
import { examCollections } from "./question-collections";

export const exams = pgTable(
  "exams",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    title: text().notNull(),
    description: text(),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    status: examStatusEnum("status").default("upcoming").notNull(),
    strategyType: strategyTypeEnum("strategy_type")
      .default("random_n")
      .notNull(),
    gradingStrategy: gradingStrategyEnum("grading_strategy")
      .default("standard_20_40_50")
      .notNull(),
    strategyConfig: json("strategy_config"),
    gradingConfig: json("grading_config"),
    config: jsonb(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [user.id],
      name: "exams_created_by_user_id_fk",
    }),
  ],
);

export const examGroups = pgTable("exam_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  examId: uuid("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  groupId: uuid("group_id")
    .notNull()
    .references(() => userGroups.id, { onDelete: "cascade" }),
  pin: text("pin"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export const examsRelations = relations(exams, ({ one, many }) => ({
  examGroups: many(examGroups),
  examCollections: many(examCollections),
  createdBy: one(user, {
    fields: [exams.createdBy],
    references: [user.id],
  }),
}));

export const examGroupsRelations = relations(examGroups, ({ one }) => ({
  exam: one(exams, {
    fields: [examGroups.examId],
    references: [exams.id],
  }),
  group: one(userGroups, {
    fields: [examGroups.groupId],
    references: [userGroups.id],
  }),
}));
