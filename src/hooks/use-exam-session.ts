"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { finishExam } from "@/lib/exam/exam-lifecycle";
import { recordMalpractice } from "@/lib/exam/malpractice-actions";
import type { Problem } from "@/types/problem";

interface UseExamSessionProps {
  assignmentId: string;
  examId: string;
  problems: Problem[];
  expiresAt: Date;
  onViolation?: (count: number) => void;
}

export function useExamSession({
  assignmentId,
  examId,
  problems,
  expiresAt,
  onViolation,
}: UseExamSessionProps) {
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [codeStorage, setCodeStorage] = useState<Map<string, string>>(
    new Map(),
  );
  const [attemptedProblems, setAttemptedProblems] = useState<Set<string>>(
    new Set(),
  );
  const [isEnded, setIsEnded] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);

  // Initialize state from local storage
  useEffect(() => {
    // Code
    const savedCode = localStorage.getItem(`exam-${assignmentId}-codes`);
    if (savedCode) {
      try {
        const parsed = JSON.parse(savedCode);
        setCodeStorage(new Map(Object.entries(parsed)));
      } catch (e) {
        console.error("Failed to load saved code:", e);
      }
    }

    // Attempted
    const savedAttempted = localStorage.getItem(
      `exam-${assignmentId}-attempted`,
    );
    if (savedAttempted) {
      try {
        const parsed = JSON.parse(savedAttempted);
        setAttemptedProblems(new Set(parsed));
      } catch (e) {
        console.error("Failed to load attempted problems:", e);
      }
    }
  }, [assignmentId]);

  const handleEndExam = useCallback(
    async (auto = false) => {
      try {
        const result = await finishExam(assignmentId);
        if (result.success) {
          setIsEnded(true);
          toast.success(
            auto
              ? "Time's up! Exam submitted."
              : "Exam submitted successfully.",
          );
          if (result.redirectPath) {
            window.location.href = result.redirectPath;
          } else {
            window.location.href = `/${examId}/results`;
          }
        } else {
          toast.error(result.error || "Failed to submit exam.");
        }
      } catch (_e) {
        toast.error("Failed to submit exam.");
      }
    },
    [assignmentId, examId],
  );

  // Timer Logic
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(expiresAt).getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));

      setTimeLeft(diff);

      if (diff === 0 && !isEnded) {
        // Time expired
        handleEndExam(true);
      }
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [
    expiresAt,
    isEnded, // Time expired
    handleEndExam,
  ]);

  const handleCodeChange = useCallback(
    (code: string) => {
      const problemId = problems[currentProblemIndex].id;

      setCodeStorage((prev) => {
        const newStorage = new Map(prev);
        newStorage.set(problemId, code);
        // Persist
        localStorage.setItem(
          `exam-${assignmentId}-codes`,
          JSON.stringify(Object.fromEntries(newStorage)),
        );
        return newStorage;
      });

      if (code.trim().length > 0) {
        setAttemptedProblems((prev) => {
          const newSet = new Set(prev);
          newSet.add(problemId);
          localStorage.setItem(
            `exam-${assignmentId}-attempted`,
            JSON.stringify([...newSet]),
          );
          return newSet;
        });
      }
    },
    [currentProblemIndex, problems, assignmentId],
  );

  const navigateTo = (index: number) => {
    if (index >= 0 && index < problems.length) {
      setCurrentProblemIndex(index);
    }
  };

  const handleViolation = useCallback(
    async (type: string) => {
      try {
        const result = await recordMalpractice(
          assignmentId,
          type,
          `${type} violation`,
          true,
        );
        if (onViolation && result.warningsLeft !== undefined) {
          const violationCount = 3 - result.warningsLeft;
          onViolation(violationCount);
        }

        if (result.terminated) {
          toast.error("Exam terminated due to multiple violations.");
          setIsEnded(true);
          // Redirect to results page
          if (result.redirectPath) {
            window.location.href = result.redirectPath;
          } else {
            window.location.href = `/${examId}/results`;
          }
        }
      } catch (e) {
        console.error("Failed to record violation:", e);
      }
    },
    [assignmentId, examId, onViolation],
  );

  return {
    currentProblem: problems[currentProblemIndex],
    currentProblemIndex,
    codeStorage,
    attemptedProblems,
    timeLeft,
    isEnded,
    handleCodeChange,
    navigateTo,
    handleViolation,
    handleEndExam,
  };
}
