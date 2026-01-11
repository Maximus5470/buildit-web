"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  PlayCircle,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getExamCreatedBy,
  hasUserBeenTerminated,
  hasUserCompletedExam,
} from "@/actions/exam-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { usePageName } from "@/hooks/use-page-name";
import { useSession } from "@/lib/auth-client";
import type { Exam } from "@/types/exam";
import type { ExamConfig } from "@/types/exam-config";

interface ExamDetailsViewProps {
  exam: Exam;
}

export function ExamDetailsView({ exam }: ExamDetailsViewProps) {
  usePageName(exam.title);
  const { data: session } = useSession();

  const getStatus = (start: Date, end: Date) => {
    const now = new Date();
    if (now < start)
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-500">
          Upcoming
        </Badge>
      );
    if (now > end) return <Badge variant="secondary">Completed</Badge>;
    return (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
        Ongoing
      </Badge>
    );
  };

  const status = getStatus(exam.startTime, exam.endTime);
  const config = exam.config as ExamConfig;

  // Determine if exam can be started
  const now = new Date();
  const isOngoing = now >= exam.startTime && now <= exam.endTime;

  const [creator, setCreator] = useState("");
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const createdBy = await getExamCreatedBy(exam.id);
        setCreator(createdBy);

        if (session?.user?.id) {
          const [completed, terminated] = await Promise.all([
            hasUserCompletedExam(exam.id, session.user.id),
            hasUserBeenTerminated(exam.id, session.user.id),
          ]);
          setHasCompleted(completed);
          setIsTerminated(terminated);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [exam.id, session?.user?.id]);

  const canStartExam = isOngoing && !hasCompleted && !isTerminated;

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{exam.title}</h1>
            {status}
          </div>
          <p className="text-muted-foreground">
            View details and instructions for this exam.
          </p>
        </div>
        <div className="flex gap-2">
          {canStartExam ? (
            <Button size="lg" className="gap-2" asChild disabled={loading}>
              <Link href={`/${exam.id}/onboarding`}>
                <PlayCircle className="h-5 w-5" /> Start Exam
              </Link>
            </Button>
          ) : (hasCompleted || isTerminated) && !loading ? (
            <Button size="lg" className="gap-2" asChild>
              <Link href={`/${exam.id}/results`}>
                <CheckCircle className="h-5 w-5" /> View Results
              </Link>
            </Button>
          ) : (
            <Button size="lg" disabled variant="outline" className="gap-2">
              {loading ? (
                "Loading..."
              ) : (
                <>
                  <PlayCircle className="h-5 w-5" />{" "}
                  {now < exam.startTime ? "Not Started" : "Exam Ended"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none">
                <p>
                  Please read the following instructions carefully before
                  starting the exam:
                </p>
                <ul className="list-disc pl-5 space-y-2 mt-4 text-muted-foreground">
                  <li>
                    Ensure you have a stable internet connection throughout the
                    exam duration.
                  </li>
                  <li>
                    The exam timer will start immediately once you click the
                    "Start Exam" button.
                  </li>
                  <li>
                    You will have{" "}
                    <strong>{exam.durationMinutes} minutes</strong> to complete
                    the exam.
                  </li>
                  <li>
                    Do not refresh the page or navigate away during the exam as
                    it may affect your submission.
                  </li>
                  <li>
                    This exam uses the{" "}
                    <strong className="capitalize">
                      {config.strategy.replace("_", " ")}
                    </strong>{" "}
                    configuration.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configuration Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <span className="text-sm font-medium text-muted-foreground block mb-1">
                    Strategy
                  </span>
                  <span className="capitalize font-medium">
                    {config.strategy.replace("_", " ")}
                  </span>
                </div>
                {config.strategy === "random_pool" && (
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <span className="text-sm font-medium text-muted-foreground block mb-1">
                      Problem Count
                    </span>
                    <span className="font-medium">{config.count}</span>
                  </div>
                )}
                {config.strategy === "fixed" && (
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <span className="text-sm font-medium text-muted-foreground block mb-1">
                      Total Problems
                    </span>
                    <span className="font-medium">
                      {config.problemIds.length}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Time & Duration</CardTitle>
              <CardDescription>Schedule information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <span className="block text-sm font-medium">Start Time</span>
                  <span className="text-sm text-muted-foreground">
                    {format(exam.startTime, "PPP")}
                    <br />
                    {format(exam.startTime, "p")}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <span className="block text-sm font-medium">End Time</span>
                  <span className="text-sm text-muted-foreground">
                    {format(exam.endTime, "PPP")}
                    <br />
                    {format(exam.endTime, "p")}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <span className="block text-sm font-medium">Duration</span>
                  <span className="text-sm text-muted-foreground">
                    {exam.durationMinutes} minutes
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <span className="block text-sm font-medium">Created By</span>
                  <span className="text-sm text-muted-foreground break-all">
                    {creator}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {(session?.user?.role === "admin" ||
            session?.user?.role === "instructor") && (
            <Card>
              <CardHeader>
                <CardTitle>Exam Access (Batch PINs)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {exam.examGroups && exam.examGroups.length > 0 ? (
                  exam.examGroups.map((eg) => (
                    <div key={eg.id}>
                      <span className="block text-sm font-medium">
                        {eg.group.name}
                      </span>
                      <div className="flex flex-col gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">
                          PIN:{" "}
                          <span className="font-mono font-bold text-primary">
                            {eg.pin || "N/A"}
                          </span>
                        </span>
                        {eg.startTime && (
                          <span className="text-xs text-muted-foreground">
                            Start: {format(new Date(eg.startTime), "MMM d, p")}
                          </span>
                        )}
                        {eg.endTime && (
                          <span className="text-xs text-muted-foreground">
                            End: {format(new Date(eg.endTime), "MMM d, p")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No groups assigned to this exam.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
