/**
 * Optimus Engine API Adapter
 *
 * Provides an interface to the Optimus code execution engine.
 * Handles API requests, response parsing, polling, and error handling.
 */

import { v4 as uuidv4 } from "uuid";

// ============================================
// Types - Request
// ============================================

export interface OptimusTestCase {
  input: string;
  expected_output: string;
  weight: number;
}

export interface OptimusExecuteRequest {
  language: "python" | "java" | "rust";
  source_code: string;
  test_cases: OptimusTestCase[];
  timeout_ms?: number;
}

// ============================================
// Types - Response
// ============================================

export type OptimusStatus =
  | "completed"
  | "failed"
  | "timedout"
  | "cancelled"
  | "pending";

export type TestStatus =
  | "passed"
  | "failed"
  | "runtimeerror"
  | "timelimitexceeded";

export interface OptimusTestResult {
  test_id: number;
  status: TestStatus;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
}

export interface OptimusExecutionResult {
  job_id: string;
  overall_status: OptimusStatus;
  score: number;
  max_score: number;
  results: OptimusTestResult[];
}

export interface OptimusPendingResponse {
  job_id: string;
  status: "pending";
  message: string;
}

// ============================================
// Adapter Configuration
// ============================================

const OPTIMUS_API_BASE_URL =
  process.env.OPTIMUS_API_URL || "http://127.0.0.1:80";

// Log the configuration on module load
console.log("Optimus API Configuration:", {
  url: OPTIMUS_API_BASE_URL,
  envVar: process.env.OPTIMUS_API_URL,
});

const POLLING_CONFIG = {
  intervalMs: 1500, // Poll every 1.5 seconds
  maxAttempts: 40, // Max 40 attempts = 60 seconds total
} as const;

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 60000;

// ============================================
// API Functions
// ============================================

/**
 * Submit code for execution and poll for results.
 *
 * @param sourceCode - The source code to execute
 * @param language - Programming language ("python", "java", or "rust")
 * @param testCases - Test cases for execution
 * @param timeoutMs - Maximum execution time (default 5000, max 60000)
 * @returns OptimusExecutionResult with execution details
 */
export async function executeCode(
  sourceCode: string,
  language: "python" | "java" | "rust",
  testCases: OptimusTestCase[],
  timeoutMs?: number,
): Promise<OptimusExecutionResult> {
  console.log("Executing code with Optimus:", {
    language,
    testCasesCount: testCases.length,
    timeoutMs,
  });

  // Submit the job
  const jobId = await submitJob(sourceCode, language, testCases, timeoutMs);

  // Poll for results
  const result = await pollForResult(jobId);

  return result;
}

/**
 * Submit a code execution job to Optimus.
 *
 * @param sourceCode - The source code to execute
 * @param language - Programming language
 * @param testCases - Test cases for execution
 * @param timeoutMs - Maximum execution time
 * @returns The job_id for polling
 */
async function submitJob(
  sourceCode: string,
  language: "python" | "java" | "rust",
  testCases: OptimusTestCase[],
  timeoutMs?: number,
): Promise<string> {
  // Validate timeout
  const validTimeout = Math.min(
    timeoutMs || DEFAULT_TIMEOUT_MS,
    MAX_TIMEOUT_MS,
  );

  const payload: OptimusExecuteRequest = {
    language,
    source_code: sourceCode,
    test_cases: testCases,
    timeout_ms: validTimeout,
  };

  // Generate idempotency key
  const idempotencyKey = uuidv4();

  const requestUrl = `${OPTIMUS_API_BASE_URL}/execute`;
  console.log("Submitting job to:", requestUrl);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  console.log("Response status:", response.status, response.statusText);

  if (!response.ok) {
    const responseText = await response.text();
    console.error("Error response body:", responseText);
    let errorMessage = `API error: ${response.status} ${response.statusText} - URL: ${requestUrl}`;
    
    try {
      const errorData = JSON.parse(responseText);
      if (errorData.message) {
        errorMessage = errorData.message;
      }
      console.error("Optimus submission error:", errorData);
    } catch {
      // If response is not JSON, use the raw text
      console.error("Optimus submission error (non-JSON):", responseText);
      if (responseText) {
        errorMessage = `${errorMessage} - Response: ${responseText}`;
      }
    }
    throw new OptimusError(errorMessage, response.status, responseText);
  }

  const data = await response.json();
  console.log("Optimus job submitted:", data);
  return data.job_id;
}

/**
 * Poll for job result until completion or timeout.
 *
 * @param jobId - The job ID to poll for
 * @returns The execution result
 */
async function pollForResult(jobId: string): Promise<OptimusExecutionResult> {
  let attempts = 0;

  console.log(`Starting to poll for job: ${jobId}`);

  while (attempts < POLLING_CONFIG.maxAttempts) {
    const pollUrl = `${OPTIMUS_API_BASE_URL}/job/${jobId}`;
    const response = await fetch(pollUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`Poll attempt ${attempts + 1}, URL: ${pollUrl}, status: ${response.status}`);

    if (response.status === 202) {
      // Job still pending, continue polling
      attempts++;
      await sleep(POLLING_CONFIG.intervalMs);
      continue;
    }

    if (response.status === 200) {
      // Job completed
      const result: OptimusExecutionResult = await response.json();
      console.log("Job completed:", result);
      return result;
    }

    // Handle errors
    const responseText = await response.text();
    let errorMessage = `Polling error: ${response.status} ${response.statusText}`;
    
    try {
      const errorData = JSON.parse(responseText);
      if (errorData.message) {
        errorMessage = errorData.message;
      }
      console.error("Polling error response:", errorData);
    } catch {
      // If response is not JSON, use the raw text
      console.error("Polling error (non-JSON):", responseText);
      if (responseText) {
        errorMessage = responseText;
      }
    }
    throw new OptimusError(errorMessage, response.status);
  }

  // Polling timed out
  console.error("Polling timed out for job:", jobId);
  throw new OptimusError("Polling timed out - job did not complete in time", 408);
}

/**
 * Cancel a pending or running job (optional).
 *
 * @param jobId - The job ID to cancel
 */
export async function cancelJob(jobId: string): Promise<void> {
  const response = await fetch(`${OPTIMUS_API_BASE_URL}/job/${jobId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    let errorMessage = `Failed to cancel job: ${response.status}`;
    
    try {
      const errorData = JSON.parse(responseText);
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // If not JSON, use raw text if available
      if (responseText) {
        errorMessage = responseText;
      }
    }
    throw new OptimusError(errorMessage, response.status);
  }
}

/**
 * Check health of the Optimus API.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OPTIMUS_API_BASE_URL}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================
// Error Handling
// ============================================

export class OptimusError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "OptimusError";
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Map language names to Optimus-supported languages.
 * Optimus only supports: python, java, rust
 */
export function mapLanguageToOptimus(
  language: string,
): "python" | "java" | "rust" {
  const normalized = language.toLowerCase();

  if (normalized === "python" || normalized === "py") {
    return "python";
  }
  if (normalized === "java") {
    return "java";
  }
  if (normalized === "rust" || normalized === "rs") {
    return "rust";
  }

  // Default to python if unknown
  console.warn(
    `Unsupported language: ${language}. Defaulting to python. Optimus only supports: python, java, rust`,
  );
  return "python";
}

/**
 * Map test cases from internal format to Optimus format.
 * Each test case gets equal weight by default.
 */
export function mapTestCases(
  testCases: Array<{ id: string; input: string; expectedOutput: string }>,
  weightPerTest: number = 10,
): OptimusTestCase[] {
  return testCases.map((tc) => ({
    input: tc.input,
    expected_output: tc.expectedOutput,
    weight: weightPerTest,
  }));
}

/**
 * Get a human-readable status message from the execution result.
 */
export function getStatusMessage(result: OptimusExecutionResult): string {
  if (result.overall_status === "completed") {
    const passedTests = result.results.filter(
      (r) => r.status === "passed",
    ).length;
    const totalTests = result.results.length;

    if (passedTests === totalTests) {
      return `All ${totalTests} test cases passed! Score: ${result.score}/${result.max_score}`;
    }
    return `${passedTests}/${totalTests} test cases passed. Score: ${result.score}/${result.max_score}`;
  }

  if (result.overall_status === "failed") {
    return "Execution failed";
  }

  if (result.overall_status === "timedout") {
    return "Execution timed out";
  }

  if (result.overall_status === "cancelled") {
    return "Execution was cancelled";
  }

  return "Execution status unknown";
}
