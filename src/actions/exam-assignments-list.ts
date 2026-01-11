"use server";

import { desc, eq } from "drizzle-orm";
import db from "@/db";
import { examAssignments } from "@/db/schema/assignments";
import { user } from "@/db/schema/auth";
import { exams } from "@/db/schema/exams";

export async function getExamAssignmentsList() {
  const assignments = await db
    .select({
      id: examAssignments.id,
      userId: examAssignments.userId,
      examId: examAssignments.examId,
      status: examAssignments.status,
      score: examAssignments.score,
      startedAt: examAssignments.startedAt,
      completedAt: examAssignments.completedAt,
      createdAt: examAssignments.createdAt,
      malpracticeCount: examAssignments.malpracticeCount,
      isTerminated: examAssignments.isTerminated,
      assignedQuestionIds: examAssignments.assignedQuestionIds,
      userName: user.name,
      userEmail: user.email,
      examTitle: exams.title,
    })
    .from(examAssignments)
    .leftJoin(user, eq(examAssignments.userId, user.id))
    .leftJoin(exams, eq(examAssignments.examId, exams.id))
    .orderBy(desc(examAssignments.createdAt));

  return {
    success: true,
    data: assignments,
    total: assignments.length,
  };
}

export async function deleteExamAssignment(assignmentId: string) {
  try {
    await db
      .delete(examAssignments)
      .where(eq(examAssignments.id, assignmentId));

    return {
      success: true,
      message: "Assignment deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return {
      success: false,
      message: "Failed to delete assignment",
    };
  }
}
