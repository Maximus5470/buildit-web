"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import db from "@/db";
import {
  assignmentSubmissions,
  examAssignments,
  questions,
  questionTestCases,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { calculateGradingScore, type GradingConfig } from "@/lib/grading";
import {
  executeCode,
  mapTestCases,
  mapLanguageToOptimus,
  OptimusError,
  type OptimusTestCase,
  type OptimusExecutionResult,
} from "@/lib/optimus";

// ============================================
// Types
// ============================================

export interface SubmitQuestionInput {
  assignmentId: string;
  questionId: string;
  code: string;
  language: string;
  version?: string;
}

export interface SubmitResult {
  success: boolean;
  verdict?: "passed" | "failed" | "compile_error" | "runtime_error";
  score?: number;
  testCasesPassed?: number;
  totalTestCases?: number;
  error?: string;
  details?: string; // Logic for more info (e.g. compilation error message)
}

// ============================================
// Server Action
// ============================================

export async function submitQuestion(
  input: SubmitQuestionInput,
): Promise<SubmitResult> {
  // 1. Auth Check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please sign in" };
  }

  try {
    // 2. Validate Assignment Ownership & Status
    const assignment = await db.query.examAssignments.findFirst({
      where: and(
        eq(examAssignments.id, input.assignmentId),
        eq(examAssignments.userId, session.user.id),
      ),
      with: {
        exam: true, // Fetch exam details for grading config
      },
    });

    if (!assignment) {
      return { success: false, error: "Assignment not found or unauthorized" };
    }

    if (assignment.status === "completed") {
      return { success: false, error: "Exam is already completed" };
    }

    // 3. Fetch Hidden Test Cases
    const hiddenTestCases = await db.query.questionTestCases.findMany({
      where: and(
        eq(questionTestCases.questionId, input.questionId),
        eq(questionTestCases.isHidden, true),
      ),
    });

    // Fallback: If no hidden cases, use ALL cases
    let gradingTestCases = hiddenTestCases;
    if (gradingTestCases.length === 0) {
      gradingTestCases = await db.query.questionTestCases.findMany({
        where: eq(questionTestCases.questionId, input.questionId),
      });
    }

    if (gradingTestCases.length === 0) {
      return { success: false, error: "No test cases found for grading" };
    }

    // 4. Optimus Execution (Hidden)
    const language = mapLanguageToOptimus(input.language);
    const optimusTestCases: OptimusTestCase[] = mapTestCases(
      gradingTestCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
    );

    const executionResult: OptimusExecutionResult = await executeCode(
      input.code,
      language,
      optimusTestCases,
    );

    // 5. Determine Verdict
    let verdict: "passed" | "failed" | "compile_error" | "runtime_error" =
      "failed";
    let passedCount = 0;
    let details = "";

    // Check for timeout
    if (executionResult.overall_status === "timedout") {
      verdict = "runtime_error";
      details = "Execution timed out";
    } 
    // Check for compilation errors (stderr without stdout)
    else if (executionResult.overall_status === "failed") {
      const firstResult = executionResult.results[0];
      if (firstResult?.stderr && !firstResult.stdout) {
        verdict = "compile_error";
        details = firstResult.stderr;
      } else {
        // Tests ran but some/all failed - count them
        passedCount = executionResult.results.filter((tc) => tc.status === "passed").length;
        
        if (passedCount === gradingTestCases.length) {
          verdict = "passed";
        } else {
          verdict = "failed";
        }
      }
    } 
    else {
      // Check test cases for completed execution
      passedCount = executionResult.results.filter((tc) => tc.status === "passed").length;

      if (passedCount === gradingTestCases.length) {
        verdict = "passed";
      } else {
        verdict = "failed";
      }
    }

    // 6. Insert Submission
    const _insertResult = await db.insert(assignmentSubmissions).values({
      assignmentId: input.assignmentId,
      questionId: input.questionId,
      language: input.language,
      code: input.code,
      verdict: verdict,
      testCasesPassed: passedCount,
      totalTestCases: gradingTestCases.length,
    });

    // 7. Calculate New Score based on Grading Strategy
    const assignedQuestionIds = assignment.assignedQuestionIds as string[];

    // Fetch all submissions for these questions to calculate best status
    const allSubmissions = await db.query.assignmentSubmissions.findMany({
      where: eq(assignmentSubmissions.assignmentId, input.assignmentId),
      columns: {
        questionId: true,
        testCasesPassed: true,
        totalTestCases: true,
        verdict: true,
      },
    });

    // Determine which questions are "passed" (fully solved) and calculate partial scores
    const passedQuestionIds = new Set<string>();
    const questionScores: Record<string, number> = {};

    for (const qId of assignedQuestionIds) {
      const qSubmissions = allSubmissions.filter((s) => s.questionId === qId);

      // Determine fully passed status
      const hasPassed = qSubmissions.some((s) => s.verdict === "passed");
      if (hasPassed) {
        passedQuestionIds.add(qId);
        questionScores[qId] = 1; // 100%
      } else {
        // Calculate best partial score
        // We find the max ratio of (testCasesPassed / totalTestCases) across all submissions
        let maxRatio = 0;
        for (const s of qSubmissions) {
          if (s.totalTestCases && s.totalTestCases > 0) {
            const ratio = (s.testCasesPassed || 0) / s.totalTestCases;
            if (ratio > maxRatio) {
              maxRatio = ratio;
            }
          }
        }
        questionScores[qId] = maxRatio;
      }
    }

    const gradingStrategy = assignment.exam.gradingStrategy;
    const gradingConfig = assignment.exam.gradingConfig as GradingConfig;
    const questionDifficulties: Record<string, "easy" | "medium" | "hard"> = {};

    if (gradingStrategy === "difficulty_based" || gradingStrategy === "standard_20_40_50") {
      const questionDetails = await db.query.questions.findMany({
        where: inArray(questions.id, assignedQuestionIds),
        columns: {
          id: true,
          difficulty: true,
        },
      });
      questionDetails.forEach((q) => {
        questionDifficulties[q.id] = q.difficulty;
      });
    }

    const newScore = calculateGradingScore({
      strategy: gradingStrategy,
      config: gradingConfig,
      passedQuestionIds: Array.from(passedQuestionIds),
      questionDifficulties,
      questionScores,
    });

    // Score is monotonically increasing - only update if new score is higher
    if (newScore > (assignment.score || 0)) {
      await db
        .update(examAssignments)
        .set({ score: newScore })
        .where(eq(examAssignments.id, input.assignmentId));
    }

    revalidatePath(`/exams/${assignment.examId}`);

    return {
      success: true,
      verdict,
      score: Math.max(newScore, assignment.score || 0),
      testCasesPassed: passedCount,
      totalTestCases: gradingTestCases.length,
      details,
    };
  } catch (error) {
    console.error("Submission error:", error);
    if (error instanceof OptimusError) {
      return {
        success: false,
        error: `Execution Engine Error: ${error.message}`,
      };
    }
    return { success: false, error: "Failed to process submission" };
  }
}
