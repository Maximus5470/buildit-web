"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/db";
import {
  examAssignments,
  examCollections,
  examGroups,
  questions,
  userGroupMembers,
} from "@/db/schema";
import { auth } from "@/lib/auth";

export async function initializeExamSession(examId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;

  try {
    // 1. Check for existing assignment (Idempotency)
    const existingAssignment = await db.query.examAssignments.findFirst({
      where: and(
        eq(examAssignments.userId, userId),
        eq(examAssignments.examId, examId),
      ),
    });

    if (existingAssignment) {
      // Block if exam was already submitted/completed
      if (existingAssignment.status === "completed") {
        return {
          success: false,
          error: "You have already submitted this exam. You cannot restart it.",
        };
      }

      return {
        success: true,
        assignmentId: existingAssignment.id,
        questionIds: existingAssignment.assignedQuestionIds,
      };
    }

    // 2. Access Control: Check Exam Group Slots
    const userMemberships = await db.query.userGroupMembers.findMany({
      where: eq(userGroupMembers.userId, userId),
    });
    const userGroupIds = userMemberships.map((m) => m.groupId);

    if (userGroupIds.length === 0) {
      throw new Error("Access Denied: You are not a member of any group.");
    }

    const relevantSlots = await db.query.examGroups.findMany({
      where: and(
        eq(examGroups.examId, examId),
        inArray(examGroups.groupId, userGroupIds),
      ),
      with: {
        exam: true,
      },
    });

    if (relevantSlots.length === 0) {
      throw new Error(
        "Access Denied: This exam is not assigned to your group.",
      );
    }

    // Check PIN Access (Cookie)
    // We check if ANY of the relevant slots require a PIN (which they all should now)
    // If a slot has a PIN, we check for the cookie.
    const doesAnySlotRequirePin = relevantSlots.some(slot => !!slot.pin);

    if (doesAnySlotRequirePin) {
      const cookieStore = await import("next/headers").then(m => m.cookies());
      const pinCookie = cookieStore.get(`exam_access_${examId}`);
      if (!pinCookie || pinCookie.value !== "true") {
        return {
          success: false,
          error: "PIN verification required. Please enter the correct PIN."
        };
      }
    }

    const now = new Date();
    let hasValidSlot = false;

    for (const slot of relevantSlots) {
      // If specific slot times are null, fallback to exam global times
      const startTime = slot.startTime ?? slot.exam.startTime;
      const endTime = slot.endTime ?? slot.exam.endTime;

      if (now >= startTime && now <= endTime) {
        hasValidSlot = true;
        break;
      }
    }

    if (!hasValidSlot) {
      throw new Error(
        "Access Denied: The exam is not currently active for your group slot.",
      );
    }

    // 3. Randomization
    // 3. Question Selection
    const examData = relevantSlots[0].exam;
    const { strategyType } = examData;
    const strategyConfig = examData.strategyConfig as any;

    const questionIds = await generateExamQuestions(
      examId,
      strategyType,
      strategyConfig,
    );

    if (questionIds.length < 3) {
      throw new Error(
        "System Error: Not enough questions in the bank to generate an exam.",
      );
    }

    // 4. Create Assignment
    const [newAssignment] = await db
      .insert(examAssignments)
      .values({
        userId,
        examId,
        assignedQuestionIds: questionIds,
        startedAt: new Date(),
        status: "in_progress",
      })
      .returning();

    return {
      success: true,
      assignmentId: newAssignment.id,
      questionIds: newAssignment.assignedQuestionIds,
    };
  } catch (error) {
    console.error("Exam Initialization Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start exam",
    };
  }
}

export async function generateExamQuestions(
  examId: string,
  strategyType: string,
  strategyConfig: any,
) {
  // Check if exam has specific collections assigned
  const linkedCollections = await db.query.examCollections.findMany({
    where: eq(examCollections.examId, examId),
    with: {
      collection: {
        with: {
          questions: true,
        },
      },
    },
  });

  let allowedQuestionIds: string[] = [];
  if (linkedCollections.length > 0) {
    // Use questions from collections
    const allowedIds = linkedCollections.flatMap((ec) =>
      ec.collection.questions.map((cq) => cq.questionId),
    );
    allowedQuestionIds = Array.from(new Set(allowedIds));

    if (allowedQuestionIds.length === 0) {
      throw new Error("Configuration Error: Assigned collections are empty.");
    }
  }

  let randomQuestions: { id: string }[] = [];

  if (strategyType === "fixed_set") {
    // Select ALL allowed questions
    const base = db.select({ id: questions.id }).from(questions);
    if (allowedQuestionIds.length > 0) {
      randomQuestions = await base.where(
        inArray(questions.id, allowedQuestionIds),
      );
    } else {
      randomQuestions = await base;
    }
  } else if (strategyType === "difficulty_mix") {
    const { easy = 0, medium = 0, hard = 0 } = strategyConfig || {};

    const fetchByDifficulty = async (
      diff: "easy" | "medium" | "hard",
      count: number,
    ) => {
      if (count <= 0) return [];
      const conditions: any[] = [eq(questions.difficulty, diff)];
      if (allowedQuestionIds.length > 0) {
        conditions.push(inArray(questions.id, allowedQuestionIds));
      }

      return db
        .select({ id: questions.id })
        .from(questions)
        .where(and(...conditions))
        .orderBy(sql`RANDOM()`)
        .limit(count);
    };

    const [easyQs, mediumQs, hardQs] = await Promise.all([
      fetchByDifficulty("easy", easy),
      fetchByDifficulty("medium", medium),
      fetchByDifficulty("hard", hard),
    ]);

    randomQuestions = [...easyQs, ...mediumQs, ...hardQs];
  } else {
    // "random_n" or default fallback
    const count = strategyConfig?.count || 3;
    const conditions: any[] = [];
    if (allowedQuestionIds.length > 0) {
      conditions.push(inArray(questions.id, allowedQuestionIds));
    }

    const query = db
      .select({ id: questions.id })
      .from(questions)
      .orderBy(sql`RANDOM()`)
      .limit(count);

    if (conditions.length > 0) {
      randomQuestions = await query.where(and(...conditions));
    } else {
      randomQuestions = await query;
    }
  }

  return randomQuestions.map((q) => q.id);
}
