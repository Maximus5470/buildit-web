"use server";

import { inArray } from "drizzle-orm";
import { headers } from "next/headers";
import db from "@/db";
import { examGroups, exams, userGroups } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { CreateExamData } from "@/types/exam";

export async function createExam(data: CreateExamData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    // Calculate global window based on group schedules if not provided
    let globalStartTime = data.startTime;
    let globalEndTime = data.endTime;

    if (
      !globalStartTime &&
      data.groupSchedules &&
      data.groupSchedules.length > 0
    ) {
      globalStartTime = new Date(
        Math.min(...data.groupSchedules.map((gs) => gs.startTime.getTime())),
      );
    }
    if (
      !globalEndTime &&
      data.groupSchedules &&
      data.groupSchedules.length > 0
    ) {
      globalEndTime = new Date(
        Math.max(...data.groupSchedules.map((gs) => gs.endTime.getTime())),
      );
    }

    const [exam] = await db
      .insert(exams)
      .values({
        title: data.title,
        startTime: globalStartTime || new Date(), // Fallback if no schedules
        endTime:
          globalEndTime || new Date(Date.now() + data.durationMinutes * 60000),
        durationMinutes: data.durationMinutes,
        config: data.config,
        createdBy: session.user.id,
      })
      .returning();

    // Assign groups to exam if provided
    let generatedPins: { groupName: string; pin: string }[] = [];
    if (data.groupIds && data.groupIds.length > 0) {
      // Fetch group names
      const assignedGroups = await db.query.userGroups.findMany({
        where: inArray(userGroups.id, data.groupIds),
      });

      const groupAssignments = assignedGroups.map((group) => {
        const schedule = data.groupSchedules?.find(
          (gs) => gs.groupId === group.id,
        );
        return {
          examId: exam.id,
          groupId: group.id,
          pin: Math.floor(100000 + Math.random() * 900000).toString(),
          startTime: schedule?.startTime,
          endTime: schedule?.endTime,
        };
      });

      await db.insert(examGroups).values(groupAssignments);

      generatedPins = groupAssignments.map((ga) => {
        const group = assignedGroups.find((g) => g.id === ga.groupId);
        return {
          groupName: group?.name || "Unknown Group",
          pin: ga.pin,
        };
      });
    }

    return { success: true, examId: exam.id, pins: generatedPins };
  } catch (error) {
    console.error("Error creating exam:", error);
    return { error: "Failed to create exam" };
  }
}
