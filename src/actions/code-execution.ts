"use server";

import {
  mapTestCases,
  executeCode as turboExecute,
  getRuntimes as turboGetRuntimes,
} from "@/lib/turbo";

const _USE_TURBO = true;

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
    const turboResult = await turboExecute(
      code,
      payload.language,
      undefined,
      payload.stdin,
      payload.version,
    );

    // Convert Turbo result to standard format
    return {
      language: turboResult.language,
      version: turboResult.version,
      run: {
        stdout: turboResult.run?.stdout || "",
        stderr: turboResult.run?.stderr || "",
        output: turboResult.run?.stdout || "",
        code: turboResult.run?.exit_code ?? null,
        signal: null,
      },
      compile: turboResult.compile
        ? {
            stdout: turboResult.compile.stdout,
            stderr: turboResult.compile.stderr,
            output: turboResult.compile.stdout,
            code: turboResult.compile.exit_code,
            signal: null,
          }
        : undefined,
    };
  } catch (error) {
    console.error("Turbo execution error:", error);
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
    const turboTestCases = mapTestCases(
      payload.testcases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: Array.isArray(tc.expectedOutput)
          ? tc.expectedOutput.join("\n")
          : tc.expectedOutput,
      })),
    );

    const turboResult = await turboExecute(
      code,
      payload.language,
      turboTestCases,
      undefined,
      payload.version,
    );

    // Convert Turbo testcase results to standard format
    const testcaseResults: TestcaseResult[] = turboResult.testcases.map(
      (tc) => ({
        id: tc.id,
        input: payload.testcases.find((t) => t.id === tc.id)?.input || "",
        expectedOutput:
          payload.testcases.find((t) => t.id === tc.id)?.expectedOutput || "",
        actualOutput: tc.actual_output,
        passed: tc.passed,
        run_details: {
          stdout: tc.run_details?.stdout || "",
          stderr: tc.run_details?.stderr || "",
          code: tc.run_details?.exit_code ?? null,
          signal: null,
          memory: tc.run_details?.memory_usage || 0,
          cpu_time: tc.run_details?.cpu_time || 0,
          wall_time: tc.run_details?.execution_time || 0,
        },
      }),
    );

    return {
      language: turboResult.language,
      version: turboResult.version,
      compile: turboResult.compile
        ? {
            stdout: turboResult.compile.stdout,
            stderr: turboResult.compile.stderr,
            output: turboResult.compile.stdout,
            code: turboResult.compile.exit_code,
            signal: null,
          }
        : undefined,
      testcases: testcaseResults,
    };
  } catch (error) {
    console.error("Turbo testcases execution error:", error);
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
  const turboRuntimes = await turboGetRuntimes();
  // Convert Turbo runtime format to expected format
  return turboRuntimes.map((runtime) => ({
    language: runtime.language,
    version: runtime.version,
    aliases: runtime.aliases,
    runtime: runtime.runtime,
  }));
}
