"use client";

import { format } from "date-fns";
import { AlertCircle, Calendar, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteExamAssignment } from "@/actions/exam-assignments-list";
import { DataItemsView } from "@/components/common/data-items/data-items-root";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageName } from "@/hooks/use-page-name";

interface Submission {
  id: string;
  examId: string;
  examTitle: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  status: string;
  score: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date | null;
  malpracticeCount: number | null;
  isTerminated: boolean | null;
  assignedQuestionIds: unknown;
}

interface SubmissionsViewProps {
  data: Submission[];
  total: number;
}

export function SubmissionsView({ data, total }: SubmissionsViewProps) {
  usePageName("Submissions");
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (assignmentId: string) => {
    setIsDeleting(true);
    try {
      const result = await deleteExamAssignment(assignmentId);
      if (result.success) {
        toast.success(
          "Assignment deleted successfully. Student can now retake the exam.",
        );
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete assignment");
      }
    } catch (error) {
      toast.error("Failed to delete assignment");
      console.error(error);
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500 bg-green-500/10 hover:bg-green-500/20";
      case "terminated":
        return "text-red-500 bg-red-500/10 hover:bg-red-500/20";
      case "in_progress":
        return "text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20";
      case "not_started":
        return "text-gray-500 bg-gray-500/10 hover:bg-gray-500/20";
      default:
        return "bg-secondary";
    }
  };

  const getQuestionCount = (assignedIds: unknown): number => {
    if (Array.isArray(assignedIds)) {
      return assignedIds.length;
    }
    return 0;
  };

  const columns = [
    {
      header: "Student",
      accessorKey: (item: Submission) => (
        <div className="flex flex-col">
          <span className="font-medium">{item.userName || "Unknown"}</span>
          <span className="text-xs text-muted-foreground">
            {item.userEmail || item.userId}
          </span>
        </div>
      ),
    },
    {
      header: "Exam",
      accessorKey: (item: Submission) => (
        <span className="font-medium">{item.examTitle || "Unknown Exam"}</span>
      ),
    },
    {
      header: "Status",
      accessorKey: (item: Submission) => (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`border-0 ${getStatusColor(item.status)}`}
          >
            {item.status.replace("_", " ").toUpperCase()}
          </Badge>
          {item.isTerminated && (
            <div className="group relative">
              <AlertCircle className="h-4 w-4 text-red-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-48 p-2 text-xs bg-popover text-popover-foreground border rounded-md shadow-md">
                Terminated due to malpractice ({item.malpracticeCount || 0}{" "}
                violations)
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Score",
      accessorKey: (item: Submission) => (
        <span className="font-semibold">{item.score ?? 0}</span>
      ),
      className: "text-center",
    },
    {
      header: "Questions",
      accessorKey: (item: Submission) => (
        <span className="text-muted-foreground">
          {getQuestionCount(item.assignedQuestionIds)}
        </span>
      ),
      className: "text-center",
    },
    {
      header: "Completed At",
      accessorKey: (item: Submission) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {item.completedAt
              ? format(new Date(item.completedAt), "MMM d, yyyy HH:mm")
              : item.startedAt
                ? format(new Date(item.startedAt), "MMM d, yyyy HH:mm")
                : "N/A"}
          </span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: (item: Submission) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDeletingId(item.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
      className: "w-[50px]",
    },
  ];

  return (
    <>
      <DataItemsView
        title="Exam Submissions"
        description="View and manage student exam submissions and attempts."
        data={data}
        totalItems={total}
        columns={columns}
        defaultView="table"
        availableViews={["table"]}
        filters={[
          {
            label: "Status",
            key: "status",
            options: [
              { label: "All", value: "all" },
              { label: "Completed", value: "completed" },
              { label: "In Progress", value: "in_progress" },
              { label: "Not Started", value: "not_started" },
              { label: "Terminated", value: "terminated" },
            ],
          },
        ]}
        sortOptions={[
          { label: "Most Recent", value: "created-desc" },
          { label: "Oldest First", value: "created-asc" },
          { label: "Name (A-Z)", value: "name-asc" },
          { label: "Name (Z-A)", value: "name-desc" },
        ]}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Exam Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset this exam assignment? This will
              allow the student to retake the exam. All their previous
              submissions and progress will be permanently deleted. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Resetting..." : "Reset Assignment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
