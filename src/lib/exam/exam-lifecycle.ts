"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import db from "@/db";
import { examAssignments, exams } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function finishExam(assignmentId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify assignment belongs to user
    const assignment = await db.query.examAssignments.findFirst({
      where: and(
        eq(examAssignments.id, assignmentId),
        eq(examAssignments.userId, session.user.id),
      ),
    });

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    if (assignment.status === "completed") {
      return {
        success: true,
        redirectPath: `/${assignment.examId}/results`,
      }; // Already completed
    }

    // Mark the assignment as completed
    await db
      .update(examAssignments)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(examAssignments.id, assignmentId));

    // Check if all assignments for this exam are completed
    const allAssignments = await db.query.examAssignments.findMany({
      where: eq(examAssignments.examId, assignment.examId),
      columns: {
        status: true,
      },
    });

    const allCompleted = allAssignments.every((a) => a.status === "completed");

    // If all assignments are completed, update exam status to "completed"
    if (allCompleted) {
      await db  
        .update(exams)
        .set({
          status: "completed",
        })
        .where(eq(exams.id, assignment.examId));

      revalidatePath("/exams");
    }

    revalidatePath(`/${assignment.examId}/session`);
    return {
      success: true,
      redirectPath: `/${assignment.examId}/results`,
    };
  } catch (error) {
    console.error("Failed to finish exam:", error);
    return { success: false, error: "Failed to finish exam" };
  }
}
