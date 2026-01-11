"use client";

import { format } from "date-fns";
import { Calendar, Clock, Info, Play, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DataItemsView } from "@/components/common/data-items/data-items-root";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePageName } from "@/hooks/use-page-name";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";

import { GetExamsParams, Exam } from "@/types/exam";

interface ExamsViewProps {
  data: Exam[];
  total: number;
  initialParams?: GetExamsParams;
  error?: string | null;
  terminationDetails?: any;
}

export function ExamsView({
  data,
  total,
  error,
  terminationDetails,
}: ExamsViewProps) {
  usePageName("Exams");
  const session = useSession();
  const router = useRouter();
  const [showError, setShowError] = useState(false);
  const [viewingPinsExam, setViewingPinsExam] = useState<Exam | null>(null);

  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  // Helper to check if exam is ongoing
  const isOngoing = (start: Date, end: Date) => {
    const now = new Date();
    return now >= start && now <= end;
  };

  // Helper for Status Badge
  const getStatus = (start: Date, end: Date, userSessionStatus?: string | null) => {
    // If user has completed the exam, show as completed
    if (userSessionStatus === "completed") {
      return <Badge variant="secondary">Completed</Badge>;
    }

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

  const columns = [
    {
      header: "Title",
      accessorKey: "title" as keyof Exam,
      className: "font-medium",
    },
    {
      header: "Status",
      accessorKey: (item: Exam) => getStatus(item.startTime, item.endTime, item.userSessionStatus),
    },
    {
      header: "Start Time",
      accessorKey: (item: Exam) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{format(item.startTime, "MMM d, yyyy h:mm a")}</span>
        </div>
      ),
    },
    {
      header: "Duration",
      accessorKey: (item: Exam) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{item.durationMinutes} mins</span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: (item: Exam) => {
        const isStaff = session.data?.user.role === "admin" || session.data?.user.role === "instructor";
        return (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                  <Link href={`/exams/${item.id}`}>
                    <Info className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View Details</p>
              </TooltipContent>
            </Tooltip>
            {isStaff && item.examGroups && item.examGroups.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                    onClick={() => setViewingPinsExam(item)}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Batch PINs</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isOngoing(item.startTime, item.endTime) &&
              !item.userSessionStatus && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-primary"
                    >
                      <Link href={`/${item.id}/onboarding`}>
                        <Play className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start Exam</p>
                  </TooltipContent>
                </Tooltip>
              )}
          </div>
        );
      },
      className: "w-[100px]",
    },
  ];

  const renderCard = (item: Exam) => (
    <div
      onClick={() => router.push(`/exams/${item.id}`)}
      className="flex flex-col h-full border rounded-xl p-6 hover:border-primary/50 transition-colors bg-card text-card-foreground shadow-sm cursor-pointer"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Calendar className="h-6 w-6 text-primary" />
        </div>
        {getStatus(item.startTime, item.endTime, item.userSessionStatus)}
      </div>

      <h3 className="text-xl font-bold mb-2 line-clamp-1">{item.title}</h3>

      <div className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>{format(item.startTime, "MMM d, h:mm a")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{item.durationMinutes} minutes</span>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t w-full flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/exams/${item.id}`}>View Details</Link>
        </Button>
        {(session.data?.user.role === "admin" || session.data?.user.role === "instructor") &&
          item.examGroups && item.examGroups.length > 0 && (
            <Button
              variant="outline"
              className="flex-1 border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => setViewingPinsExam(item)}
            >
              View PINs
            </Button>
          )}
        {item.userSessionStatus === "completed" ? (
          <Button asChild className="flex-1">
            <Link href={`/${item.id}/results`}>View Results</Link>
          </Button>
        ) : isOngoing(item.startTime, item.endTime) &&
        !item.userSessionStatus && (
          <Button asChild className="flex-1">
            <Link href={`/${item.id}/onboarding`}>Start Exam</Link>
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <DataItemsView
        title="Exams"
        description="Manage and view all exams."
        data={data}
        totalItems={total}
        columns={columns}
        renderCard={renderCard}
        defaultView="card"
        availableViews={["card", "table"]}
        filters={[
          {
            label: "Status",
            key: "status",
            options: [
              { label: "Upcoming", value: "upcoming" },
              { label: "Ongoing", value: "ongoing" },
              { label: "Completed", value: "completed" },
            ],
          },
        ]}
        sortOptions={[
          { label: "Newest Created", value: "created-desc" }, // Default logic in server action handles null, but we can match
          { label: "Date (Ascending)", value: "date-asc" },
          { label: "Date (Descending)", value: "date-desc" },
          { label: "Title (A-Z)", value: "title-asc" },
        ]}
        createAction={
          session?.data?.user.role === "instructor" ||
            session?.data?.user.role === "admin"
            ? {
              label: "Create Exam",
              onClick: () => {
                router.push("/exams/create");
              },
            }
            : undefined
        }
      />

      <AlertDialog open={showError} onOpenChange={setShowError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {error === "exam_terminated" ? "Exam Terminated" : "Error"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {error === "invalid_session" ? (
                "The exam session is invalid or has expired."
              ) : error === "exam_terminated" ? (
                <div className="space-y-4">
                  <p>
                    The exam has been terminated due to security violations.
                  </p>
                  {terminationDetails && (
                    <div className="bg-muted p-4 rounded-md text-sm">
                      <p className="font-semibold mb-2"> violation Log:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {terminationDetails.events?.map(
                          (event: any, i: number) => (
                            <li key={i}>
                              <span className="font-medium">
                                {event.type === "fullscreen_exit"
                                  ? "Exited Fullscreen"
                                  : event.type === "tab_switch"
                                    ? "Switched Tab"
                                    : event.type}
                              </span>{" "}
                              <span className="text-muted-foreground text-xs">
                                at {new Date(event.timestamp).toLocaleString()}
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                      <p className="mt-2 font-semibold text-destructive">
                        Total Violations: {terminationDetails.violationCount}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                "An unexpected error occurred."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowError(false)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingPinsExam} onOpenChange={(open: boolean) => !open && setViewingPinsExam(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batch PINs: {viewingPinsExam?.title}</DialogTitle>
            <DialogDescription>
              Unique access codes for each assigned batch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {viewingPinsExam?.examGroups?.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{item.group.name}</p>
                  <p className="font-mono text-2xl font-bold tracking-widest text-primary">
                    {item.pin}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${item.group.name} - ${item.pin}`);
                    toast.success(`PIN for ${item.group.name} copied!`);
                  }}
                >
                  Copy
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingPinsExam(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
