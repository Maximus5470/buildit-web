"use client";

import { AlertTriangle, BookOpen, Clock, Monitor, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { initializeExamSession } from "@/lib/exam/exam-actions";
import { verifyExamPin } from "@/actions/verify-exam-pin";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

import { Exam } from "@/types/exam";

interface OnboardingClientProps {
  exam: Exam;
  requiresPin: boolean;
}

export default function OnboardingClient({
  exam,
  requiresPin,
}: OnboardingClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [pinStatus, setPinStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");

  const verifyPin = async (value: string) => {
    setPinStatus("verifying");
    try {
      const result = await verifyExamPin(exam.id, value);
      if (result.success) {
        setPinStatus("success");
        toast.success("PIN Verified");
      } else {
        setPinStatus("error");
        toast.error("Incorrect PIN");
        setPin(""); // Option: Clear or keep? User usually wants to retry. Keeping it and highlighting red is better, but resetting "error" on change clears it.
      }
    } catch {
      setPinStatus("error");
      toast.error("Verification failed");
    }
  };

  const handleStartExam = async () => {
    try {
      // 1. Request Fullscreen
      await document.documentElement.requestFullscreen();
    } catch (_error) {
      toast.error(
        "Fullscreen is required to take this exam. Please grant permission.",
      );
      return;
    }

    setIsLoading(true);

    try {
      // 2. Initialize Session
      const result = await initializeExamSession(exam.id);

      if (result.success) {
        toast.success("Exam started successfully.");
        router.push(`/${exam.id}/session`);
      } else {
        // If failed, exit fullscreen (optional, but good UX)
        await document.exitFullscreen().catch(() => { });
        toast.error(result.error || "Failed to start exam.");
      }
    } catch (error) {
      console.error(error);
      await document.exitFullscreen().catch(() => { });
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">{exam.title}</CardTitle>
          <CardDescription className="text-lg">
            Please read the rules carefully before starting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{exam.durationMinutes} Minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>3 Questions</span>
            </div>
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Strict Environment Enforced</AlertTitle>
            <AlertDescription>
              This exam is monitored. Switching tabs, minimizing the window, or
              exiting fullscreen will be recorded as malpractice incidents.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Monitor className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold">Fullscreen Mode</h4>
                <p className="text-sm text-muted-foreground">
                  The exam must be taken in fullscreen mode using a modern
                  desktop browser.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Shield className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold">No Distractions</h4>
                <p className="text-sm text-muted-foreground">
                  Clipboard access is restricted. Background activity is
                  monitored.
                </p>
              </div>
            </div>
          </div>

          {exam.description && (
            <div className="rounded-lg bg-muted p-4">
              <h4 className="mb-2 font-semibold">Instructions</h4>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {exam.description}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pb-8">
          <div className="w-full max-w-sm space-y-4">
            {requiresPin && (
              <div className="flex flex-col items-center gap-2">
                <label className="text-sm font-medium">
                  Enter Exam PIN to Enable Start
                </label>
                <div className={cn(
                  "p-1 rounded-lg transition-all duration-300",
                  pinStatus === "success" && "bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500",
                  pinStatus === "error" && "bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500"
                )}>
                  <InputOTP
                    maxLength={6}
                    value={pin}
                    onChange={(value) => {
                      setPin(value);
                      if (value.length === 6) {
                        verifyPin(value);
                      } else {
                        setPinStatus("idle");
                      }
                    }}
                    disabled={isLoading || pinStatus === "success" || pinStatus === "verifying"}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {pinStatus === "verifying" && (
                  <p className="text-xs text-muted-foreground animate-pulse">Verifying PIN...</p>
                )}
                {pinStatus === "success" && (
                  <p className="text-xs text-green-600 font-medium">PIN Verified!</p>
                )}
                {pinStatus === "error" && (
                  <p className="text-xs text-red-600 font-medium">Incorrect PIN</p>
                )}
              </div>
            )}

            <Button
              size="lg"
              onClick={handleStartExam}
              disabled={isLoading || (requiresPin && pinStatus !== "success")}
              className={cn(
                "w-full text-lg transition-all",
                (!requiresPin || pinStatus === "success")
                  ? "bg-primary hover:bg-primary/90 text-white shadow-lg"
                  : "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? "Starting Exam..." : "Start Exam"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
