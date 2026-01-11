"use client";

import { Clock, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { finishExam } from "@/lib/exam/exam-lifecycle";

interface ExamHeaderProps {
  user: {
    name: string;
    image?: string;
  };
  endTime?: Date;
  examTitle: string;
  assignmentId: string;
}

export function ExamHeader({
  user,
  endTime,
  examTitle,
  assignmentId,
}: ExamHeaderProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<string>("00:00:00");
  const [isFinishing, setIsFinishing] = useState(false);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const submitExam = async (force: boolean = false) => {
    if (isFinishing) return;

    setIsFinishing(true);
    toast.info(force ? "Time's up! Submitting exam..." : "Finishing exam...");

    const result = await finishExam(assignmentId);

    if (result.success && result.redirectPath) {
      toast.success("Exam submitted successfully");
      router.push(result.redirectPath);
    } else {
      toast.error(result.error || "Failed to submit exam");
      setIsFinishing(false);
    }
  };

  useEffect(() => {
    if (!endTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = endTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        clearInterval(interval);
        // Trigger auto-submit
        submitExam(true);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [
    endTime, // Trigger auto-submit
    submitExam,
  ]);

    const handleFinishClick = () => setShowConfirmDialog(true);
  const handleConfirmFinish = () => {
    setShowConfirmDialog(false);
    submitExam(false);
  };

  return (
    <>
      <header className="relative flex w-full items-center justify-between border-b bg-background px-4 py-2">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="h-6 w-px bg-border hidden sm:block"></div>
          <h1 className="text-sm font-semibold hidden sm:block">{examTitle}</h1>
        </div>

        {/* Center Section - Absolute Positioning */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 font-mono text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className={timeLeft === "00:00:00" ? "text-red-500" : ""}>
              {timeLeft}
            </span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={handleFinishClick}
            disabled={isFinishing}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isFinishing ? "Submitting..." : "End Exam"}
            </span>
          </Button>
          <div className="flex items-center gap-2 border-l pl-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs text-muted-foreground">Student</p>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image} alt={user.name} />
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently submit your
              exam and you won't be able to change your answers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmFinish}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              End Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
