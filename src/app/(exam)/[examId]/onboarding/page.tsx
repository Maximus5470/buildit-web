import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import OnboardingClient from "@/components/layouts/exam/onboarding-client";
import db from "@/db";
import { examGroups, exams, userGroupMembers } from "@/db/schema";
import { auth } from "@/lib/auth";

interface PageProps {
  params: Promise<{
    examId: string;
  }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { examId } = await params;

  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  if (!exam) {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  let requiresPin = false;
  let batchSchedule = null;

  if (session?.user) {
    // Check if any of the user's groups for this exam has a PIN or specific schedule
    const memberships = await db.query.userGroupMembers.findMany({
      where: eq(userGroupMembers.userId, session.user.id),
    });
    const groupIds = memberships.map((m) => m.groupId);

    if (groupIds.length > 0) {
      const slots = await db.query.examGroups.findMany({
        where: and(
          eq(examGroups.examId, examId),
          inArray(examGroups.groupId, groupIds)
        ),
      });
      requiresPin = slots.some((s) => !!s.pin);

      // Find the relevant schedule for the user
      batchSchedule = slots.find(s => s.startTime || s.endTime);
    }
  }

  // Final check: if batch schedule exists, use it. Otherwise use global.
  const now = new Date();
  const activeStart = batchSchedule?.startTime || exam.startTime;
  const activeEnd = batchSchedule?.endTime || exam.endTime;

  if (now < activeStart || now > activeEnd) {
    // If not in time, we could redirect or just let OnboardingClient handle it 
    // but the request was "can see their exam ONLY when the time criteria is met".
    // If they already have the link, they shouldn't see the onboarding details.
    notFound();
  }

  return <OnboardingClient exam={exam} requiresPin={requiresPin} />;
}
