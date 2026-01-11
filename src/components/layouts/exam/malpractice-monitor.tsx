"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useExamSecurity } from "@/hooks/exam/use-exam-security";

// This component now primarily handles the visual Blocking/Warning interface
// and ensures Fullscreen is active.
export function MalpracticeMonitor({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [showTabSwitchDialog, setShowTabSwitchDialog] = useState(false);

  // Listen to violations and show blocking dialog for tab switches
  useExamSecurity((event) => {
    if (event.type === "tab_switch" && event.isSevere) {
      setShowTabSwitchDialog(true);
    }
  });

  useEffect(() => {
    // Initial check and subsequent checks for fullscreen
    const checkFullscreen = () => {
      if (!document.fullscreenElement) {
        setShowFullscreenPrompt(true);
      } else {
        setShowFullscreenPrompt(false);
      }
    };

    checkFullscreen();
    document.addEventListener("fullscreenchange", checkFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", checkFullscreen);
  }, []);

  const handleEnterFullscreen = () => {
    document.documentElement.requestFullscreen().catch((err) => {
      console.error("Could not enter fullscreen:", err);
    });
  };

  const handleTabSwitchAcknowledge = () => {
    setShowTabSwitchDialog(false);
  };

  return (
    <>
      <div
        className={
          showFullscreenPrompt || showTabSwitchDialog
            ? "blur-sm pointer-events-none select-none"
            : ""
        }
      >
        {children}
      </div>

      {/* Fullscreen Dialog */}
      <AlertDialog open={showFullscreenPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enter Fullscreen Mode</AlertDialogTitle>
            <AlertDialogDescription>
              Please enter fullscreen mode to continue your exam.
              <br />
              Exiting fullscreen mode during the exam is recorded as a
              violation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleEnterFullscreen}>
              Enter Fullscreen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tab Switch Dialog */}
      <AlertDialog open={showTabSwitchDialog}>
        <AlertDialogContent className="z-9999">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ⚠️ Tab Switch Detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              You switched tabs or minimized the exam window. This is a
              violation of exam rules and has been recorded.
              <br />
              <br />
              <span className="font-semibold text-foreground">
                Multiple violations will result in exam termination.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleTabSwitchAcknowledge}>
              I Understand - Continue Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
