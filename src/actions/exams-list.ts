"use server";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  type SQL,
  sql,
} from "drizzle-orm";
import db from "@/db";
import {
  examAssignments,
  examGroups,
  exams,
  userGroupMembers,
} from "@/db/schema";
import type { GetExamsParams } from "@/types/exam";

export async function getExams({
  page = 1,
  perPage = 10,
  search,
  status,
  sort,
  userId,
}: GetExamsParams) {
  const currentTimestamp = new Date();

  // Base conditions
  const conditions = [];

  // Search
  if (search) {
    conditions.push(ilike(exams.title, `%${search}%`));
  }

  // Status Filter
  if (status === "upcoming") {
    conditions.push(gt(exams.startTime, currentTimestamp));
  } else if (status === "ongoing") {
    conditions.push(
      and(
        lte(exams.startTime, currentTimestamp),
        gte(exams.endTime, currentTimestamp),
      ),
    );
  } else if (status === "completed") {
    conditions.push(lt(exams.endTime, currentTimestamp));
  }
  // If no status is specified, we might want to return all, or default to something.
  // The user requirement says "I want to filter exams by status", so explicit filter is handled above.
  // If they don't provide it, we show all.

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Sorting
  const statusOrder = sql`
    CASE 
      WHEN ${exams.startTime} <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AND ${exams.endTime} >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 1
      WHEN ${exams.startTime} > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 2
      ELSE 3
    END
  `;

  let orderBy: SQL[] = [asc(statusOrder), desc(exams.createdAt)]; // Default sort

  if (sort === "title-asc") orderBy = [asc(exams.title)];
  if (sort === "title-desc") orderBy = [desc(exams.title)];
  if (sort === "date-asc") orderBy = [asc(exams.startTime)];
  if (sort === "date-desc") orderBy = [desc(exams.startTime)];

  // If userId is provided, filter exams to only those assigned to user's groups
  let data: (typeof exams.$inferSelect)[] = [];
  let total = 0;

  if (userId) {
    // Get the groups that the user belongs to
    const userGroupsResult = await db
      .select({ groupId: userGroupMembers.groupId })
      .from(userGroupMembers)
      .where(eq(userGroupMembers.userId, userId));

    const userGroupIds = userGroupsResult.map((ug) => ug.groupId);

    if (userGroupIds.length === 0) {
      return { data: [], total: 0 };
    }

    // Get exam IDs that are assigned to user's groups WITH scheduling constraints
    // If examGroups has startTime/endTime, use those. Otherwise fall back to global.
    const examGroupsData = await db
      .select({
        examId: examGroups.examId,
        groupId: examGroups.groupId,
        startTime: examGroups.startTime,
        endTime: examGroups.endTime,
      })
      .from(examGroups)
      .where(inArray(examGroups.groupId, userGroupIds));

    if (examGroupsData.length === 0) {
      return { data: [], total: 0 };
    }

    // Filter relevant exams based on their batch schedules
    const relevantExams = examGroupsData.filter((eg) => {
      // If batch schedule is provided, check it
      if (eg.startTime && currentTimestamp < eg.startTime) return false;
      if (eg.endTime && currentTimestamp > eg.endTime) return false;
      return true;
    });

    const allowedExamIds = Array.from(
      new Set(relevantExams.map((eg) => eg.examId)),
    );

    if (allowedExamIds.length === 0) {
      return { data: [], total: 0 };
    }

    // Add exam ID filter to conditions
    const examIdCondition = inArray(exams.id, allowedExamIds);
    const finalWhereClause = whereClause
      ? and(whereClause, examIdCondition)
      : examIdCondition;

    // Data Query
    data = await db.query.exams.findMany({
      where: finalWhereClause,
      limit: perPage,
      offset: (page - 1) * perPage,
      orderBy: orderBy,
    });

    // Count Query
    const countResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(exams)
      .where(finalWhereClause);

    total = countResult[0]?.count ?? 0;

    // For students, override the global startTime/endTime in the returned data
    // with their batch-specific schedule if available.
    data = data.map((exam) => {
      const batchSchedule = examGroupsData.find(
        (eg) => eg.examId === exam.id && userGroupIds.includes(eg.groupId),
      );
      return {
        ...exam,
        startTime: batchSchedule?.startTime || exam.startTime,
        endTime: batchSchedule?.endTime || exam.endTime,
      };
    });
  } else {
    // No userId provided, return all exams (for admin view) with PINs
    data = await db.query.exams.findMany({
      where: whereClause,
      limit: perPage,
      offset: (page - 1) * perPage,
      orderBy: orderBy,
      with: {
        examGroups: {
          with: {
            group: true,
          },
        },
      },
    });

    const countResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(exams)
      .where(whereClause || sql`TRUE`);

    total = countResult[0]?.count ?? 0;
  }

  // If userId is provided, fetch user's assignment status for each exam
  let userAssignments: Record<string, { status: string }> = {};
  if (userId && data.length > 0) {
    const examIds = data.map((exam) => exam.id);
    const assignments = await db
      .select({
        examId: examAssignments.examId,
        status: examAssignments.status,
      })
      .from(examAssignments)
      .where(
        and(
          eq(examAssignments.userId, userId),
          inArray(examAssignments.examId, examIds),
        ),
      );

    userAssignments = Object.fromEntries(
      assignments.map((a) => [a.examId, { status: a.status }]),
    );
  }

  // Attach user assignment status to each exam
  const dataWithStatus = data.map((exam) => ({
    ...exam,
    userSessionStatus: userAssignments[exam.id]?.status || null,
  }));

  return { data: dataWithStatus, total };
}

// Helper to check lt
