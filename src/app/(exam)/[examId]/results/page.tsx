import { and, eq, inArray } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import db from "@/db";
import { examAssignments, questions } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { GradingConfig } from "@/lib/grading";
import { ReturnToDashboardButton } from "./return-to-dashboard-button";

interface ResultsPageProps {
  params: Promise<{
    examId: string;
  }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { examId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const assignment = await db.query.examAssignments.findFirst({
    where: and(
      eq(examAssignments.examId, examId),
      eq(examAssignments.userId, session.user.id),
    ),
    with: {
      exam: true,
      submissions: {
        columns: {
          questionId: true,
        },
      },
    },
  });

  if (!assignment) {
    notFound();
  }

  // Calculate stats
  const score = assignment.score || 0;
  // Count unique questions attempted based on submissions
  const questionsAttempted = new Set(
    assignment.submissions.map((s) => s.questionId),
  ).size;
  const totalQuestions = (assignment.assignedQuestionIds as string[]).length;

  // Calculate Total Possible Score
  let totalPossibleScore = 0;
  const gradingStrategy = assignment.exam.gradingStrategy;
  const gradingConfig = assignment.exam.gradingConfig as GradingConfig;

  if (gradingStrategy === "linear") {
    totalPossibleScore = totalQuestions * (gradingConfig?.marks || 0);
  } else if (gradingStrategy === "difficulty_based") {
    const assignedQuestionIds = assignment.assignedQuestionIds as string[];
    if (assignedQuestionIds.length > 0) {
      const questionDetails = await db.query.questions.findMany({
        where: inArray(questions.id, assignedQuestionIds),
        columns: {
          difficulty: true,
        },
      });

      const difficultyMarks = {
        easy: gradingConfig?.easy || 0,
        medium: gradingConfig?.medium || 0,
        hard: gradingConfig?.hard || 0,
      };

      for (const q of questionDetails) {
        totalPossibleScore += difficultyMarks[q.difficulty] || 0;
      }
    }
  } else if (gradingStrategy === "count_based") {
    const rules = (gradingConfig?.rules || []) as {
      count: number;
      marks: number;
    }[];
    // Max possible score is the max marks defined in rules
    if (rules.length > 0) {
      totalPossibleScore = Math.max(...rules.map((r) => r.marks));
    }
  } else {
    // Default fallback (legacy behavior was 50)
    totalPossibleScore = 50;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Exam Completed</CardTitle>
          <CardDescription>
            You have successfully submitted your exam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Total Score
            </div>
            <div className="text-5xl font-bold tracking-tighter">
              {score}
              <span className="text-2xl text-muted-foreground/50">
                /{totalPossibleScore}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Time Taken</div>
              <div className="font-mono font-medium">
                {assignment.completedAt && assignment.startedAt
                  ? (() => {
                      const diff =
                        assignment.completedAt.getTime() -
                        assignment.startedAt.getTime();
                      const minutes = Math.floor(diff / 60000);
                      return `${minutes} min`;
                    })()
                  : "--"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Questions Attempted
              </div>
              <div className="font-mono font-medium">
                {questionsAttempted} / {totalQuestions}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <ReturnToDashboardButton />
        </CardFooter>
      </Card>
    </div>
  );
}
