"use client";

import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { foldEffect } from "@codemirror/language";
import CodeMirror from "@uiw/react-codemirror";
import { ChevronDown, Loader2, Play, Send } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getRuntimes,
  runCode,
  runWithCustomInput,
} from "@/lib/exam/code-actions";
import { useExamStore } from "@/stores/exam-store";
import { Problem, TestcaseResult } from "@/types/problem";
import ThemeToggle from "@/components/common/theme-toggle";
import { ButtonGroup } from "@/components/ui/button-group";
import TestCaseConsole from "./test-case-console";

interface Runtime {
  language: string;
  version: string;
}

interface CodePlaygroundProps {
  question: Pick<Problem, "id" | "driverCode" | "testCases">;
  assignmentId: string;
}

export function CodePlayground({
  question,
  assignmentId,
}: CodePlaygroundProps) {
  const { code, setCode } = useExamStore();
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  // Runtime State
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("java");
  const [selectedVersion, setSelectedVersion] = useState<string | undefined>();
  const [runtimeLoading, setRuntimeLoading] = useState(true);

  // Console State
  const [activeTab, setActiveTab] = useState("test-cases");
  const [customInput, setCustomInput] = useState("");
  const [results, setResults] = useState<TestcaseResult[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<{
    stdout: string;
    stderr: string;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rate Limiting
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Editor State
  const viewRef = useRef<any>(null); // Using any to avoid importing EditorView type directly

  const foldBoilerplate = useCallback((view: any) => {
    if (!view) return;

    const doc = view.state.doc;
    const text = doc.toString();
    const _lines = text.split("\n");
    const effects = [];

    const javaStartMarker = "// region boilerplate";
    const javaEndMarker = "// endregion";
    const pythonStartMarker = "# region boilerplate";
    const pythonEndMarker = "# endregion";

    let startLine = -1;

    // Iterate through lines to find regions
    // We use line iteration from the doc to get accurate positions
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const lineText = line.text.trim();

      if (lineText === javaStartMarker || lineText === pythonStartMarker) {
        startLine = i;
      } else if (
        (lineText === javaEndMarker || lineText === pythonEndMarker) &&
        startLine !== -1
      ) {
        // Found a region
        // We want to fold from the end of the start line to the end of the end line
        const startPos = doc.line(startLine).to;
        const endPos = line.to;

        try {
          effects.push(foldEffect.of({ from: startPos, to: endPos }));
        } catch (e) {
          console.error("Failed to create fold effect", e);
        }

        startLine = -1;
      }
    }

    if (effects.length > 0) {
      view.dispatch({ effects });
    }
  }, []);

  const onCreateEditor = useCallback(
    (view: any) => {
      viewRef.current = view;
      foldBoilerplate(view);
    },
    [foldBoilerplate],
  );

  // Refold when question changes

  // Fetch runtimes on mount
  useEffect(() => {
    async function fetchRuntimes() {
      const result = await getRuntimes();
      setRuntimeLoading(false);

      if (result.success && result.runtimes) {
        setRuntimes(result.runtimes);

        // Auto-select version for default language (java)
        const javaRuntime = result.runtimes.find((r) => r.language === "java");
        if (javaRuntime) {
          setSelectedVersion(javaRuntime.version);
        }
      } else {
        toast.error(result.error || "Failed to load runtimes");
      }
    }

    fetchRuntimes();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update version when language changes
  useEffect(() => {
    const languageRuntimes = runtimes.filter(
      (r) => r.language === selectedLanguage,
    );
    if (languageRuntimes.length > 0) {
      // Keep current version if valid for new language (unlikely but possible if versions match)
      // Or just default to first available
      if (!languageRuntimes.find((r) => r.version === selectedVersion)) {
        setSelectedVersion(languageRuntimes[0].version);
      }
    } else {
      setSelectedVersion(undefined);
    }
  }, [selectedLanguage, selectedVersion, runtimes]);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading Editor...
      </div>
    );
  }

  const defaultCode =
    (question.driverCode as Record<string, string> | null)?.[
    selectedLanguage
    ] || "";

  // Access code for specific language
  const currentCode =
    question.id in code && code[question.id]?.[selectedLanguage]
      ? code[question.id][selectedLanguage]
      : defaultCode;

  const handleRun = async () => {
    if (!selectedVersion) {
      toast.error(`No ${selectedLanguage} runtime available.`);
      return;
    }

    if (cooldown > 0) return;

    // Start cooldown
    setCooldown(5);

    setIsRunning(true);
    setResults([]); // Clear previous results
    setConsoleOutput(null);

    // Determine if running test cases or custom input
    if (activeTab === "custom") {
      // Run with custom input
      const result = await runWithCustomInput({
        code: currentCode,
        language: selectedLanguage,
        version: selectedVersion,
        stdin: customInput,
      });

      // ... (rest of handleRun same logic, just confirm variable usage)

      setIsRunning(false);

      if (result.compilationError) {
        setConsoleOutput({
          stdout: "",
          stderr: `Compilation Error:\n${result.compilationError}`,
        });
        toast.error("Compilation failed");
        return;
      }

      if (!result.success) {
        setConsoleOutput({
          stdout: "",
          stderr: result.error || "Execution failed",
        });
        toast.error(result.error || "Execution failed");
        return;
      }

      setConsoleOutput({
        stdout: result.stdout || "",
        stderr: result.stderr || "",
      });

      if (result.stderr) {
        toast.warning("Executed with errors");
      } else {
        toast.success(`Executed in ${result.executionTime}ms`);
      }
    } else {
      // Run against test cases
      setActiveTab("results");

      const result = await runCode({
        code: currentCode,
        language: selectedLanguage,
        version: selectedVersion,
        testCases: question.testCases,
      });

      setIsRunning(false);

      if (result.compilationError) {
        // Switch to custom tab to show compilation error in output area
        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: `Compilation Error:\n${result.compilationError}`,
        });
        toast.error("Compilation failed");
        return;
      }

      if (!result.success) {
        // Switch to custom tab to show execution error
        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: result.error || "Execution failed",
        });
        toast.error(result.error || "Execution failed");
        return;
      }

      if (result.results) {
        setResults(result.results);
        const passed = result.results.filter((r) => r.passed).length;
        const total = result.results.length;

        if (passed === total) {
          toast.success(`All ${total} test cases passed!`);
        } else {
          toast.warning(`${passed}/${total} test cases passed`);
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedVersion) {
      toast.error(`No ${selectedLanguage} runtime available.`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Dynamically import to avoid circular dependency issues if any
      const { submitQuestion } = await import("@/lib/exam/submit-actions");

      const result = await submitQuestion({
        assignmentId,
        questionId: question.id,
        code: currentCode,
        language: selectedLanguage,
        version: selectedVersion,
      });

      // ... (rest of handleSubmit logic)

      if (!result.success) {
        toast.error(result.error || "Submission failed");
        if (result.verdict === "compile_error" && result.details) {
          setActiveTab("custom");
          setConsoleOutput({
            stdout: "",
            stderr: `Submission Compilation Error:\n${result.details}`,
          });
        }
        return;
      }

      // Handle Success Verdicts
      if (result.verdict === "passed") {
        toast.success("Correct Answer!", {
          description: `You passed all hidden test cases. Score updated to ${result.score}.`,
        });
      } else if (result.verdict === "failed") {
        toast.warning("Submission Recorded", {
          description: `Code saved, but only ${result.testCasesPassed}/${result.totalTestCases} hidden test cases passed.`,
        });
      } else if (result.verdict === "compile_error") {
        toast.error("Compilation Error", {
          description: "Your code failed to compile on submission.",
        });
        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: `Submission Compilation Error:\n${result.details}`,
        });
      } else if (result.verdict === "runtime_error") {
        toast.error("Runtime Error", {
          description:
            "Your code encountered a runtime error during submission.",
        });
        setActiveTab("custom");
        setConsoleOutput({
          stdout: "",
          stderr: `Submission Runtime Error:\n${result.details}`,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize={60} minSize={30}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-1">
            <div className="flex items-center gap-3">
              <Select
                value={selectedLanguage}
                onValueChange={setSelectedLanguage}
              >
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                </SelectContent>
              </Select>

              {/* Runtime Version Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    disabled={runtimeLoading || runtimes.length === 0}
                  >
                    {runtimeLoading
                      ? "Loading..."
                      : selectedVersion
                        ? `${selectedLanguage} ${selectedVersion}`
                        : `No ${selectedLanguage} Runtime`}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {runtimes
                    .filter((r) => r.language === selectedLanguage)
                    .map((runtime) => (
                      <DropdownMenuItem
                        key={`${runtime.language}-${runtime.version}`}
                        onClick={() => setSelectedVersion(runtime.version)}
                        className={
                          selectedVersion === runtime.version
                            ? "bg-accent"
                            : undefined
                        }
                      >
                        {runtime.language} {runtime.version}
                      </DropdownMenuItem>
                    ))}
                  {runtimes.filter((r) => r.language === selectedLanguage)
                    .length === 0 &&
                    !runtimeLoading && (
                      <DropdownMenuItem disabled>
                        No runtimes available
                      </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRun}
                  disabled={isRunning || !selectedVersion || cooldown > 0}
                  className="gap-1.5"
                >
                  {isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {isRunning
                    ? "Running..."
                    : cooldown > 0
                      ? `Run (${cooldown}s)`
                      : "Run"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedVersion || isRunning}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-foreground"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </ButtonGroup>
            </div>
          </div>
          <div className="flex-1 overflow-hidden text-[14px]">
            <CodeMirror
              key={question.id}
              value={currentCode}
              height="100%"
              extensions={[
                selectedLanguage === "java" ? java() : python(),
                // Add folding logic here or just rely on onCreateEditor?
                // foldBoilerplate already uses dispatch which works on view.
              ]}
              onChange={(val) => setCode(question.id, selectedLanguage, val)}
              theme={theme === "dark" ? "dark" : "light"}
              className="h-full"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
              }}
              onCreateEditor={onCreateEditor}
            />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle
        className="w-full h-px"
        orientation="horizontal"
        withHandle
      />
      <ResizablePanel defaultSize={40} minSize={20}>
        <TestCaseConsole
          testCases={question.testCases}
          results={results}
          consoleOutput={consoleOutput}
          customInput={customInput}
          onCustomInputChange={setCustomInput}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isRunning={isRunning}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
