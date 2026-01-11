"use client";

import { History, RefreshCcw } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSubmissions,
  type SubmissionHistoryItem,
} from "@/lib/exam/history-actions";
import { cn } from "@/lib/utils";
import { useExamStore } from "@/stores/exam-store";
import type { Problem } from "@/types/problem";

interface ProblemViewerProps {
  question: Pick<Problem, "id" | "problemStatement">;
  assignmentId: string;
}

export function ProblemViewer({ question, assignmentId }: ProblemViewerProps) {
  const [activeTab, setActiveTab] = useState("description");

  if (!question) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Select a question to view.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background min-w-0">
      <Tabs
        defaultValue="description"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex h-full flex-col min-w-0"
      >
        <div className="border-b px-4 py-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="description"
          className="flex-1 min-h-0 overflow-hidden p-0 m-0 min-w-0"
        >
          <ScrollArea className="h-full">
            <div className="p-6">
              {/* <h1 className="mb-6 text-2xl font-bold">{question.title}</h1> */}
              <div className="max-w-none min-w-0 grid grid-cols-[minmax(0,1fr)]">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ className, ...props }) => (
                      <h1
                        className={cn(
                          "mt-2 scroll-m-20 text-4xl font-bold tracking-tight",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    h2: ({ className, ...props }) => (
                      <h2
                        className={cn(
                          "mt-10 scroll-m-20 border-b pb-1 text-3xl font-semibold tracking-tight first:mt-0",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    h3: ({ className, ...props }) => (
                      <h3
                        className={cn(
                          "mt-8 scroll-m-20 text-2xl font-semibold tracking-tight",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    h4: ({ className, ...props }) => (
                      <h4
                        className={cn(
                          "mt-8 scroll-m-20 text-xl font-semibold tracking-tight",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    h5: ({ className, ...props }) => (
                      <h5
                        className={cn(
                          "mt-8 scroll-m-20 text-lg font-semibold tracking-tight",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    h6: ({ className, ...props }) => (
                      <h6
                        className={cn(
                          "mt-8 scroll-m-20 text-base font-semibold tracking-tight",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    a: ({ className, ...props }) => (
                      <a
                        className={cn(
                          "font-medium underline underline-offset-4",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    p: ({ className, ...props }) => (
                      <p
                        className={cn("leading-7 not-first:mt-6", className)}
                        {...props}
                      />
                    ),
                    ul: ({ className, ...props }) => (
                      <ul
                        className={cn("my-6 ml-6 list-disc", className)}
                        {...props}
                      />
                    ),
                    ol: ({ className, ...props }) => (
                      <ol
                        className={cn("my-6 ml-6 list-decimal", className)}
                        {...props}
                      />
                    ),
                    li: ({ className, ...props }) => (
                      <li className={cn("mt-2", className)} {...props} />
                    ),
                    blockquote: ({ className, ...props }) => (
                      <blockquote
                        className={cn(
                          "mt-6 border-l-2 pl-6 italic *:text-muted-foreground",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    img: ({
                      className,
                      alt,
                      src,
                    }: React.ImgHTMLAttributes<HTMLImageElement>) => (
                      <NextImage
                        className={cn("rounded-md border", className)}
                        alt={alt || "Image"}
                        src={(src as string) || ""}
                        width={600}
                        height={400}
                        style={{ maxWidth: "100%", height: "auto" }}
                      />
                    ),
                    hr: ({ ...props }) => (
                      <hr className="my-4 md:my-8" {...props} />
                    ),
                    table: ({ className, ...props }) => (
                      <div className="my-6 w-full overflow-y-auto">
                        <table className={cn("w-full", className)} {...props} />
                      </div>
                    ),
                    tr: ({ className, ...props }) => (
                      <tr
                        className={cn(
                          "m-0 border-t p-0 even:bg-muted",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    th: ({ className, ...props }) => (
                      <th
                        className={cn(
                          "border px-4 py-2 text-left font-bold [[align=center]]:text-center [[align=right]]:text-right",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    td: ({ className, ...props }) => (
                      <td
                        className={cn(
                          "border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right",
                          className,
                        )}
                        {...props}
                      />
                    ),
                    pre: ({ className, ...props }) => (
                      <ScrollArea className="mb-4 mt-6 rounded-lg border max-w-full">
                        <pre
                          className={cn(
                            "px-4 py-4 [&_code]:border-none [&_code]:bg-transparent [&_code]:p-0",
                            className,
                          )}
                          {...props}
                        />
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    ),
                    code: ({ className, ...props }) => (
                      <code
                        className={cn(
                          "relative rounded border bg-primary/10 px-[0.3rem] py-[0.2rem] font-mono text-sm",
                          className,
                        )}
                        {...props}
                      />
                    ),
                  }}
                >
                  {question.problemStatement}
                </Markdown>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="submissions"
          className="flex-1 min-h-0 overflow-hidden p-0 m-0"
        >
          <SubmissionsList
            assignmentId={assignmentId}
            questionId={question.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SubmissionsList({
  assignmentId,
  questionId,
}: {
  assignmentId: string;
  questionId: string;
}) {
  const { setCode } = useExamStore();
  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const result = await getSubmissions(assignmentId, questionId);
      if (mounted) {
        if (result.success && result.submissions) {
          setSubmissions(result.submissions);
        } else {
          // Quietly fail or show empty state, likely no submissions found or error
        }
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [assignmentId, questionId]);

  const handleRestore = (code: string, language: string) => {
    // Confirm restore? Maybe too annoying. Just restore.
    setCode(questionId, language, code);
    toast.success(`Restored ${language} code to editor`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        Loading history...
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <History className="mb-2 size-8 opacity-50" />
        <p>No submissions yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {submissions.map((sub, idx) => (
          <div
            key={sub.id}
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold capitalize ${
                      sub.verdict === "passed"
                        ? "text-green-500"
                        : sub.verdict === "failed"
                          ? "text-red-500"
                          : "text-amber-500"
                    }`}
                  >
                    {sub.verdict.replace("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{submissions.length - idx}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(sub.createdAt).toLocaleString()}
                </span>
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                  {sub.language}
                </span>
                {sub.verdict === "failed" && sub.testCasesPassed !== null && (
                  <span className="text-xs text-muted-foreground">
                    {sub.testCasesPassed} passed
                  </span>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => handleRestore(sub.code, sub.language)}
              >
                <RefreshCcw className="size-3.5" />
                Restore
              </Button>
            </div>
            <div className="rounded-md bg-muted/50 font-mono text-xs grid">
              <div className="max-h-[150px] overflow-auto p-3">
                <pre>{sub.code}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
