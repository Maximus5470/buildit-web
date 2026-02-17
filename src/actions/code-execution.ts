"use server";

import {
  mapTestCases,
  executeCode as optimusExecute,
  mapLanguageToOptimus,
  type OptimusTestCase,
} from "@/lib/optimus";

export type FileContent = {
  name?: string;
  content: string;
  encoding?: "base64" | "hex" | "utf8";
};

export type ExecuteCodePayload = {
  language: string;
  version: string;
  files: FileContent[];
  stdin?: string;
  args?: string[];
  run_timeout?: number;
  compile_timeout?: number;
  compile_memory_limit?: number;
  run_memory_limit?: number;
};

export type ExecuteCodeResponse = {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    output: string;
    code: number | null;
    signal: string | null;
  };
  compile?: {
    stdout: string;
    stderr: string;
    output: string;
    code: number | null;
    signal: string | null;
  };
  message?: string;
};

export type Testcase = {
  id: string;
  input: string;
  expectedOutput: string | string[];
};

export type ExecuteTestcasesPayload = {
  language: string;
  version: string;
  files: FileContent[];
  testcases: Testcase[];
  args?: string[];
  run_timeout?: number;
  compile_timeout?: number;
  compile_memory_limit?: number;
  run_memory_limit?: number;
};

export type TestcaseResult = {
  id: string;
  input: string;
  expectedOutput: string | string[];
  actualOutput: string;
  passed: boolean;
  run_details: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    memory: number;
    cpu_time: number;
    wall_time: number;
  };
};

export type ExecuteTestcasesResponse = {
  language: string;
  version: string;
  compile?: {
    stdout: string;
    stderr: string;
    output: string;
    code: number | null;
    signal: string | null;
  };
  testcases: TestcaseResult[];
  message?: string;
};

export async function executeCode(
  payload: ExecuteCodePayload,
): Promise<ExecuteCodeResponse> {
  try {
    const code = payload.files[0]?.content || "";
    const language = mapLanguageToOptimus(payload.language);

    // For simple stdin execution (no test cases), create a single test case
    const testCases: OptimusTestCase[] = [
      {
        input: payload.stdin || "",
        expected_output: "", // No expected output for custom input
        weight: 10,
      },
    ];

    const optimusResult = await optimusExecute(
      code,
      language,
      testCases,
      payload.run_timeout,
    );

    // Extract the first (and only) test result
    const testResult = optimusResult.results[0];

    // Convert Optimus result to standard format
    return {
      language: payload.language,
      version: payload.version,
      run: {
        stdout: testResult?.stdout || "",
        stderr: testResult?.stderr || "",
        output: testResult?.stdout || "",
        code: testResult?.status === "passed" ? 0 : 1,
        signal: null,
      },
    };
  } catch (error) {
    console.error("Optimus execution error:", error);
    return {
      language: payload.language,
      version: payload.version,
      run: {
        stdout: "",
        stderr:
          error instanceof Error ? error.message : "Unknown error occurred",
        output:
          error instanceof Error ? error.message : "Unknown error occurred",
        code: -1,
        signal: null,
      },
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function executeTestcases(
  payload: ExecuteTestcasesPayload,
): Promise<ExecuteTestcasesResponse> {
  try {
    const code = payload.files[0]?.content || "";
    const language = mapLanguageToOptimus(payload.language);
    
    // Map test cases to Optimus format
    const optimusTestCases = mapTestCases(
      payload.testcases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: Array.isArray(tc.expectedOutput)
          ? tc.expectedOutput.join("\n")
          : tc.expectedOutput,
      })),
    );

    const optimusResult = await optimusExecute(
      code,
      language,
      optimusTestCases,
      payload.run_timeout,
    );

    // Convert Optimus testcase results to standard format
    const testcaseResults: TestcaseResult[] = optimusResult.results.map(
      (result, index) => {
        const originalTestCase = payload.testcases[index];
        return {
          id: originalTestCase?.id || index.toString(),
          input: originalTestCase?.input || "",
          expectedOutput: originalTestCase?.expectedOutput || "",
          actualOutput: result.stdout,
          passed: result.status === "passed",
          run_details: {
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.status === "passed" ? 0 : 1,
            signal: null,
            memory: 0, // Optimus doesn't provide memory info
            cpu_time: result.execution_time_ms,
            wall_time: result.execution_time_ms,
          },
        };
      },
    );

    return {
      language: payload.language,
      version: payload.version,
      testcases: testcaseResults,
    };
  } catch (error) {
    console.error("Optimus testcases execution error:", error);
    return {
      language: payload.language,
      version: payload.version,
      testcases: payload.testcases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: "",
        passed: false,
        run_details: {
          stdout: "",
          stderr:
            error instanceof Error ? error.message : "Unknown error occurred",
          code: -1,
          signal: null,
          memory: 0,
          cpu_time: 0,
          wall_time: 0,
        },
      })),
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function getRuntimes() {
  // Optimus supports: python, java, rust
  // Return a hardcoded list of supported runtimes
  return [
    {
      language: "python",
      version: "3.11",
      aliases: ["py", "python3"],
      runtime: "Python",
    },
    {
      language: "java",
      version: "17",
      aliases: [],
      runtime: "Java",
    },
    {
      language: "rust",
      version: "1.70",
      aliases: ["rs"],
      runtime: "Rust",
    },
  ];
}
