"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  executeCode,
  mapTestCases,
  mapLanguageToOptimus,
  OptimusError,
  type OptimusTestCase,
  type OptimusExecutionResult,
} from "@/lib/optimus";
import type { TestcaseResult } from "@/types/problem";

// ============================================
// Types
// ============================================

export interface RunCodeInput {
  code: string;
  language: string;
  version?: string;
  testCases: Array<{ id: string; input: string; expectedOutput: string }>;
}

export interface RunCodeResult {
  success: boolean;
  results?: TestcaseResult[];
  error?: string;
  compilationError?: string;
  executionTime?: number;
}

export interface RunCustomInput {
  code: string;
  language: string;
  version?: string;
  stdin: string;
}

export interface RunCustomResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  compilationError?: string;
  executionTime?: number;
}

// ============================================
// Server Actions
// ============================================

/**
 * Run code against provided test cases.
 * Used for the "Run" button to test against visible test cases.
 */
export async function runCode(input: RunCodeInput): Promise<RunCodeResult> {
  // Auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please sign in" };
  }

  try {
    const language = mapLanguageToOptimus(input.language);
    const optimusTestCases: OptimusTestCase[] = mapTestCases(input.testCases);

    const result: OptimusExecutionResult = await executeCode(
      input.code,
      language,
      optimusTestCases,
    );

    // Check for compilation or severe runtime errors
    if (result.overall_status === "timedout") {
      return {
        success: false,
        error: "Execution timed out",
      };
    }

    // Check if there's a compilation error (would show in stderr without stdout)
    const firstResult = result.results[0];
    if (firstResult?.stderr && !firstResult.stdout && result.overall_status === "failed") {
      return {
        success: false,
        compilationError: firstResult.stderr,
      };
    }

    // Map Optimus results to our TestcaseResult format
    // Include results even if some/all failed - let the UI show the details
    // IMPORTANT: Match by test_id since Optimus may return results in different order
    // Optimus uses 1-based test_id, so test_id 1 corresponds to input.testCases[0]
    const testResults: TestcaseResult[] = input.testCases.map((testCase, index) => {
      // Find the matching result by test_id (1-based from Optimus)
      const optimusResult = result.results.find(r => r.test_id === index + 1);
      
      if (!optimusResult) {
        // Shouldn't happen, but handle gracefully
        console.error(`No Optimus result found for test case ${index + 1}`);
        return {
          id: testCase.id,
          passed: false,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: "",
          run_details: {
            stdout: "",
            stderr: "No result returned from execution engine",
          },
        };
      }

      return {
        id: testCase.id,
        passed: optimusResult.status === "passed",
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: optimusResult.stdout,
        run_details: {
          stdout: optimusResult.stdout,
          stderr: optimusResult.stderr,
        },
      };
    });

    const passedCount = testResults.filter(tc => tc.passed).length;
    const totalCount = testResults.length;
    
    console.log(`Test results: ${passedCount}/${totalCount} passed`);
    
    // Debug: Log first failed test case for inspection
    const firstFailed = testResults.find(tc => !tc.passed);
    if (firstFailed) {
      console.log("First failed test case:");
      console.log("  Expected:", JSON.stringify(firstFailed.expectedOutput));
      console.log("  Actual:  ", JSON.stringify(firstFailed.actualOutput));
      console.log("  Match:", firstFailed.expectedOutput === firstFailed.actualOutput);
    }

    return {
      success: true,
      results: testResults,
      executionTime: result.results[0]?.execution_time_ms,
    };
  } catch (error) {
    console.error("Code execution error:", error);

    if (error instanceof OptimusError) {
      return {
        success: false,
        error: `Execution service error: ${error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute code",
    };
  }
}

/**
 * Run code with custom stdin input.
 * Used for the "Custom Input" tab to test with user-provided input.
 */
export async function runWithCustomInput(
  input: RunCustomInput,
): Promise<RunCustomResult> {
  // Auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized: Please sign in" };
  }

  try {
    const language = mapLanguageToOptimus(input.language);
    
    // For custom input, create a single test case with the stdin
    const testCase: OptimusTestCase = {
      input: input.stdin,
      expected_output: "", // No expected output for custom input
      weight: 10,
    };

    const result: OptimusExecutionResult = await executeCode(
      input.code,
      language,
      [testCase],
    );

    // Get the first (and only) test result
    const testResult = result.results[0];

    // Check for compilation errors (stderr without stdout)
    if (result.overall_status === "timedout") {
      return {
        success: false,
        error: "Execution timed out",
      };
    }

    if (testResult?.stderr && !testResult.stdout && result.overall_status === "failed") {
      return {
        success: false,
        compilationError: testResult.stderr,
      };
    }

    // Return output even if there are runtime errors (stderr)
    // This allows users to see what their code actually printed
    return {
      success: true,
      stdout: testResult?.stdout || "",
      stderr: testResult?.stderr || "",
      executionTime: testResult?.execution_time_ms,
    };
  } catch (error) {
    console.error("Custom input execution error:", error);

    if (error instanceof OptimusError) {
      return {
        success: false,
        error: `Execution service error: ${error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute code",
    };
  }
}

/**
 * Fetch available Language runtimes from Optimus.
 * Optimus supports: python, java, rust
 * Returns hardcoded list of supported runtimes.
 */
export async function getRuntimes(): Promise<{
  success: boolean;
  runtimes?: Array<{ language: string; version: string }>;
  error?: string;
}> {
  try {
    // Optimus supports: python, java, rust
    // Return hardcoded list matching the available languages
    const runtimes: Array<{ language: string; version: string }> = [
      { language: "python", version: "3.11" },
      { language: "java", version: "17" },
      { language: "rust", version: "1.70" },
    ];

    return {
      success: true,
      runtimes,
    };
  } catch (error) {
    console.error("Failed to fetch runtimes:", error);

    if (error instanceof OptimusError) {
      return {
        success: false,
        error: `Failed to connect to execution service: ${error.message}`,
      };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch runtimes",
    };
  }
}
