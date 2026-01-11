"use server";

import { and, eq } from "drizzle-orm";
import { cache } from "react";
import db from "@/db";
import { examAssignments, exams, user, userGroupMembers } from "@/db/schema";

export const getExam = cache(async (examId: string, userId?: string) => {
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    with: {
      examGroups: {
        with: {
          group: true,
        },
      },
    },
  });

  if (exam && userId) {
    // If it's a student, we might want to override times for them
    // Check if they are in any group assigned to this exam
    const userGroupsResult = await db.query.userGroupMembers.findMany({
      where: eq(userGroupMembers.userId, userId),
    });
    const userGroupIds = userGroupsResult.map((ug) => ug.groupId);

    const batchSchedule = exam.examGroups.find((eg) =>
      userGroupIds.includes(eg.groupId),
    );
    if (batchSchedule && (batchSchedule.startTime || batchSchedule.endTime)) {
      return {
        ...exam,
        startTime: batchSchedule.startTime || exam.startTime,
        endTime: batchSchedule.endTime || exam.endTime,
      };
    }
  }

  return exam;
});

export const getExamCreatedBy = cache(async (examId: string) => {
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId));
  const [creator] = await db
    .select()
    .from(user)
    .where(eq(user.id, exam.createdBy));
  return creator.name;
});

export const hasUserCompletedExam = cache(
  async (examId: string, userId: string) => {
    const [assignment] = await db
      .select()
      .from(examAssignments)
      .where(
        and(
          eq(examAssignments.examId, examId),
          eq(examAssignments.userId, userId),
          eq(examAssignments.status, "completed"),
        ),
      );
    return !!assignment;
  },
);

export const hasUserBeenTerminated = cache(
  async (examId: string, userId: string) => {
    const [assignment] = await db
      .select()
      .from(examAssignments)
      .where(
        and(
          eq(examAssignments.examId, examId),
          eq(examAssignments.userId, userId),
          eq(examAssignments.isTerminated, true),
        ),
      );
    return !!assignment;
  },
);
