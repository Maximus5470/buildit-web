"use client";

import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AntiCheatGuard } from "./anti-cheat-guard";

import { CodePlayground } from "./code-playground";
import { ExamHeader } from "./exam-header";
import { ExamSidebar } from "./exam-sidebar";
import { ProblemViewer } from "./problem-viewer";

import { Problem, TestCase } from "@/types/problem";

// Minimal question type for exam sessions
type ExamQuestion = Pick<Problem, "id" | "title" | "problemStatement" | "driverCode"> & {
  testCases: TestCase[];
};

interface IDEShellProps {
  questions: ExamQuestion[];
  user: {
    name: string;
    image?: string;
  };
  endTime?: Date;
  examTitle: string;
  assignmentId: string;
  completedQuestionIds: string[];
}

export function IDEShell({
  questions,
  user,
  endTime,
  examTitle,
  assignmentId,
  completedQuestionIds,
}: IDEShellProps) {
  const [activeQuestionId, setActiveQuestionId] = useQueryState("q", {
    defaultValue: questions[0]?.id || "",
  });

  const [_isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const activeQuestion =
    questions.find((q) => q.id === activeQuestionId) || questions[0];

  if (!activeQuestion)
    return (
      <div className="flex h-screen items-center justify-center">
        No questions available.
      </div>
    );

  return (
    <SidebarProvider>
      <ExamSidebar
        examTitle={examTitle}
        questions={questions}
        activeId={activeQuestionId || activeQuestion.id}
        onSelect={setActiveQuestionId}
        completedQuestionIds={completedQuestionIds}
      />
      <SidebarInset className="h-screen overflow-hidden flex flex-col">
        <AntiCheatGuard assignmentId={assignmentId} />
        <ExamHeader
          user={user}
          endTime={endTime}
          examTitle={examTitle}
          assignmentId={assignmentId}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel defaultSize={40} minSize={30}>
              <ProblemViewer
                question={activeQuestion}
                assignmentId={assignmentId}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={60} minSize={30}>
              <CodePlayground
                question={activeQuestion}
                assignmentId={assignmentId}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
