"use client";

import { useState } from "react";
import {
  type ExecuteCodePayload,
  type ExecuteCodeResponse,
  type ExecuteTestcasesPayload,
  type ExecuteTestcasesResponse,
  executeCode,
  executeTestcases,
} from "@/actions/code-execution";

export function useCodeExecution() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    ExecuteCodeResponse | ExecuteTestcasesResponse | null
  >(null);

  const runCode = async (payload: ExecuteCodePayload) => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await executeCode(payload);
      if (response.message) {
        setError(response.message);
      }
      setResult(response);
      return response;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setIsRunning(false);
    }
  };

  const runTestcases = async (payload: ExecuteTestcasesPayload) => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await executeTestcases(payload);
      if (response.message) {
        setError(response.message);
      }
      setResult(response);
      return response;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setIsRunning(false);
    }
  };

  return {
    runCode,
    runTestcases,
    isRunning,
    error,
    result,
  };
}
