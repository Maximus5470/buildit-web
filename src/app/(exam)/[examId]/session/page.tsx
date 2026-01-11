import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { IDEShell } from "@/components/layouts/exam/ide-shell";
import db from "@/db";
import {
  assignmentSubmissions,
  examAssignments,
  exams,
  questions,
} from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  const assignment = await db.query.examAssignments.findFirst({
    where: and(
      eq(examAssignments.userId, session.user.id),
      eq(examAssignments.examId, examId),
    ),
  });

  if (!assignment) {
    // Determine what to do if no assignment - maybe redirect or show error
    return (
      <div className="flex h-screen items-center justify-center">
        Error: Exam session not initialized. Please try onboarding again.
      </div>
    );
  }

  // Fetch only the questions assigned to this user
  const questionIds = assignment.assignedQuestionIds as string[];

  if (!questionIds || questionIds.length === 0) {
    return <div>No questions assigned.</div>;
  }

  const questionList = await db.query.questions.findMany({
    where: inArray(questions.id, questionIds),
    with: {
      testCases: {
        where: (tc, { eq }) => eq(tc.isHidden, false),
        columns: {
          id: true,
          input: true,
          expectedOutput: true,
        },
      },
    },
  });

  // Fetch exam details for title and config
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    columns: {
      title: true,
      durationMinutes: true,
    },
  });

  // Calculate strict end time based on assignment start time or exam duration
  // For now, using assignment.startedAt + duration would be best if we had startedAt.
  // Falling back to current time + duration for demo purposes if startedAt is missing, or duration.
  const durationMs = (exam?.durationMinutes || 90) * 60 * 1000;
  const assignmentStartedAt = assignment.startedAt
    ? new Date(assignment.startedAt)
    : new Date();
  const endTime = new Date(assignmentStartedAt.getTime() + durationMs);

  // Fetch passed submissions for this assignment to mark questions as completed
  const passedSubmissions = await db.query.assignmentSubmissions.findMany({
    where: and(
      eq(assignmentSubmissions.assignmentId, assignment.id),
      eq(assignmentSubmissions.verdict, "passed"),
    ),
    columns: {
      questionId: true,
    },
  });

  const completedQuestionIds = passedSubmissions.map((s) => s.questionId);

  return (
    <IDEShell
      questions={questionList}
      user={{ name: session.user.name, image: session.user.image || undefined }}
      endTime={endTime}
      examTitle={exam?.title || "Exam Session"}
      assignmentId={assignment.id}
      completedQuestionIds={completedQuestionIds}
    />
  );
}
