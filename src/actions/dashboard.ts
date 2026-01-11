"use server";

import { count, desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import db from "@/db";
import {
  assignmentSubmissions,
  dailyProblems,
  exams,
  questions,
  user,
} from "@/db/schema";

export const getStudentDashboardData = unstable_cache(
  async (userId: string, userName: string) => {
    // Get user's recent submissions from exam assignments
    const userSubmissions = await db
      .select({
        createdAt: assignmentSubmissions.createdAt,
        verdict: assignmentSubmissions.verdict,
      })
      .from(assignmentSubmissions)
      .innerJoin(
        sql`exam_assignments`,
        sql`assignment_submissions.assignment_id = exam_assignments.id`,
      )
      .where(sql`exam_assignments.user_id = ${userId}`)
      .orderBy(desc(assignmentSubmissions.createdAt))
      .limit(100);

    // Calculate streak (simplified)
    let streak = 0;
    if (userSubmissions.length > 0) {
      streak = Math.min(userSubmissions.length, 12);
    }

    // Weekly Progress (Last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });

    const weeklyProgress = last7Days.map((dateStr) => {
      return userSubmissions.some(
        (s) =>
          s.createdAt &&
          s.createdAt.toISOString().split("T")[0] === dateStr &&
          s.verdict === "passed",
      );
    });

    // Submissions and solved counts
    const totalSolved = userSubmissions.filter(
      (s) => s.verdict === "passed",
    ).length;
    const totalSubmissions = userSubmissions.length;

    const upcomingExams = await db
      .select()
      .from(exams)
      .limit(5)
      .orderBy(desc(exams.createdAt));

    // Get or create today's daily problem
    const dailyProblemData = await ensureDailyProblem();

    // Format daily problem for the UI
    const dailyProblem = dailyProblemData
      ? {
          problem: {
            id: dailyProblemData.questionId,
            title: dailyProblemData.questionTitle || "",
            difficulty: dailyProblemData.questionDifficulty || "medium",
            slug: dailyProblemData.questionId, // Use ID as slug since questions don't have slug
          },
          stats: {
            solvedCount: 0, // Can be enhanced later
            acceptanceRate: 0, // Can be enhanced later
            tags: [], // Tags not in schema
            estimatedTime: "30 mins", // Default estimate
          },
        }
      : null;

    return {
      dailyProblem,
      stats: {
        totalSolved,
        totalSubmissions,
        streak,
        rank: 1500, // Mock rank
        points: 450, // Mock points
      },
      upcomingExams,
      userName,
      weeklyProgress,
    };
  },
  ["student-dashboard"],
  { revalidate: 3600, tags: ["dashboard"] },
);

export const getFacultyDashboardData = unstable_cache(
  async (_userId: string) => {
    const activeStudents = await db
      .select({ count: count() })
      .from(user)
      .where(eq(user.role, "student"));

    return {
      dailyProblem: null, // Feature removed
      activeStudents: activeStudents[0]?.count || 0,
      recentActivity: [],
    };
  },
  ["faculty-dashboard"],
  { revalidate: 3600, tags: ["dashboard"] },
);

export const getAdminDashboardData = unstable_cache(
  async () => {
    const totalUsers = await db.select({ count: count() }).from(user);
    const totalQuestions = await db.select({ count: count() }).from(questions);
    const totalSubmissions = await db
      .select({ count: count() })
      .from(assignmentSubmissions);

    return {
      totalUsers: totalUsers[0]?.count || 0,
      totalProblems: totalQuestions[0]?.count || 0,
      totalSubmissions: totalSubmissions[0]?.count || 0,
      uptime: process.uptime(),
    };
  },
  ["admin-dashboard"],
  { revalidate: 60, tags: ["dashboard"] },
);

export async function ensureDailyProblem() {
  const today = new Date().toISOString().split("T")[0];

  // Check if there's already a daily problem for today
  const existingDailyProblem = await db
    .select({
      id: dailyProblems.id,
      date: dailyProblems.date,
      questionId: dailyProblems.questionId,
      questionTitle: questions.title,
      questionDifficulty: questions.difficulty,
    })
    .from(dailyProblems)
    .leftJoin(questions, eq(dailyProblems.questionId, questions.id))
    .where(eq(dailyProblems.date, today))
    .limit(1);

  if (existingDailyProblem.length > 0) {
    return existingDailyProblem[0];
  }

  // Get recently used question IDs (last 30 days) to avoid repetition
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentDailyProblems = await db
    .select({ questionId: dailyProblems.questionId })
    .from(dailyProblems)
    .where(
      sql`${dailyProblems.date} >= ${thirtyDaysAgo.toISOString().split("T")[0]}`,
    );

  const recentQuestionIds = recentDailyProblems.map((dp) => dp.questionId);

  // Get all available questions
  const allQuestions = await db.select().from(questions);

  if (allQuestions.length === 0) {
    throw new Error("No questions available for daily problem");
  }

  // Filter out recently used questions
  const availableQuestions =
    recentQuestionIds.length > 0
      ? allQuestions.filter((q) => !recentQuestionIds.includes(q.id))
      : allQuestions;

  // If all questions were used recently, use any question
  const questionPool =
    availableQuestions.length > 0 ? availableQuestions : allQuestions;

  // Select a random question
  const randomQuestion =
    questionPool[Math.floor(Math.random() * questionPool.length)];

  // Create new daily problem
  const [newDailyProblem] = await db
    .insert(dailyProblems)
    .values({
      date: today,
      questionId: randomQuestion.id,
    })
    .returning();

  // Fetch the complete daily problem with question data
  const completeDailyProblem = await db
    .select({
      id: dailyProblems.id,
      date: dailyProblems.date,
      questionId: dailyProblems.questionId,
      questionTitle: questions.title,
      questionDifficulty: questions.difficulty,
    })
    .from(dailyProblems)
    .leftJoin(questions, eq(dailyProblems.questionId, questions.id))
    .where(eq(dailyProblems.id, newDailyProblem.id))
    .limit(1);

  return completeDailyProblem[0];
}
