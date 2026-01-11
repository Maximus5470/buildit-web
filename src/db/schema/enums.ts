import { pgEnum } from "drizzle-orm/pg-core";

export const difficulty = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const problemType = pgEnum("problem_type", [
  "coding",
  "mcq_single",
  "mcq_multi",
  "true_false",
  "descriptive",
]);
export const userRole = pgEnum("user_role", ["student", "instructor", "admin"]);
export const pinStrategy = pgEnum("pin_strategy", [
  "always",
  "new_device",
  "random",
]);

// Assignment and exam enums
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "not_started",
  "in_progress",
  "completed",
]);
export const submissionVerdictEnum = pgEnum("submission_verdict", [
  "passed",
  "failed",
  "compile_error",
  "runtime_error",
]);
export const examStatusEnum = pgEnum("exam_status", [
  "upcoming",
  "ongoing",
  "completed",
]);
export const strategyTypeEnum = pgEnum("strategy_type", [
  "random_n",
  "fixed_set",
  "difficulty_mix",
]);
export const gradingStrategyEnum = pgEnum("grading_strategy", [
  "standard_20_40_50",
  "linear",
  "difficulty_based",
  "count_based",
]);

// Deprecated enums (kept for backward compatibility with old tables)
// These will be removed in the next major version
export const sessionStatus = pgEnum("session_status", [
  "in_progress",
  "submitted",
  "terminated",
]);
export const submissionStatus = pgEnum("submission_status", [
  "pending",
  "accepted",
  "wrong_answer",
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "compile_error",
  "runtime_error",
  "manual_review",
]);
