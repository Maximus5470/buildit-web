"use client";

import { format } from "date-fns";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addQuestionToCollection,
  getAllQuestions,
  removeQuestionFromCollection,
} from "@/actions/question-collections-list";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageName } from "@/hooks/use-page-name";

interface Question {
  id: string;
  title: string;
  problemStatement: string;
  difficulty: string;
  allowedLanguages: string[];
  addedAt?: Date;
}

interface QuestionCollection {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface CollectionDetailsViewProps {
  collection: QuestionCollection;
  questions: Question[];
  total: number;
  currentPage: number;
}

export function CollectionDetailsView({
  collection,
  questions,
  total,
  currentPage,
}: CollectionDetailsViewProps) {
  usePageName(collection.title);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  const perPage = 10;
  const totalPages = Math.ceil(total / perPage);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "hard":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "";
    }
  };

  const handlePageChange = (page: number) => {
    router.push(`/collections/${collection.id}?page=${page}`);
  };

  const handleRemoveQuestion = async (questionId: string) => {
    startTransition(async () => {
      const result = await removeQuestionFromCollection(
        collection.id,
        questionId,
      );
      if (result.success) {
        toast.success("Question removed from collection");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to remove question");
      }
    });
  };

  const handleAddQuestion = async (questionId: string) => {
    startTransition(async () => {
      const result = await addQuestionToCollection(collection.id, questionId);
      if (result.success) {
        toast.success("Question added to collection");
        // Remove the added question from available questions
        setAvailableQuestions((prev) =>
          prev.filter((q) => q.id !== questionId),
        );
        // Refresh the page data
        router.refresh();
      } else {
        toast.error(result.error || "Failed to add question");
      }
    });
  };

  const loadAvailableQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      const allQuestions = await getAllQuestions(searchQuery);
      // Filter out questions already in the collection
      const questionIds = new Set(questions.map((q) => q.id));
      const filtered = allQuestions
        .filter((q) => !questionIds.has(q.id))
        .map((q) => ({
          ...q,
          allowedLanguages: (q.allowedLanguages as string[]) || [],
        }));
      setAvailableQuestions(filtered);
    } catch (_error) {
      toast.error("Failed to load questions");
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleOpenAddDialog = () => {
    setIsAddDialogOpen(true);
    loadAvailableQuestions();
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/collections">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            {collection.title}
          </h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAddDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Question
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] md:max-w-[800px] lg:max-w-[900px]">
            <DialogHeader>
              <DialogTitle>Add Questions</DialogTitle>
              <DialogDescription>
                Search and select questions to add to this collection
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search questions by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      loadAvailableQuestions();
                    }
                  }}
                  className="pl-9"
                />
              </div>

              {/* Questions List */}
              <div className="border rounded-lg">
                <ScrollArea className="h-[400px]">
                  <div className="p-4">
                    {isLoadingQuestions ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="mt-4 text-sm text-muted-foreground">
                          Loading questions...
                        </p>
                      </div>
                    ) : availableQuestions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="rounded-full bg-muted p-3 mb-4">
                          <Search className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">
                          No questions found
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {searchQuery
                            ? "Try a different search term"
                            : "Click search to load questions"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableQuestions.map((question) => (
                          <div
                            key={question.id}
                            className="group flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0 space-y-2">
                              <h4 className="font-medium text-sm leading-tight">
                                {question.title}
                              </h4>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getDifficultyColor(question.difficulty)}`}
                                >
                                  {question.difficulty}
                                </Badge>
                                {question.allowedLanguages
                                  .slice(0, 3)
                                  .map((lang) => (
                                    <Badge
                                      key={lang}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {lang}
                                    </Badge>
                                  ))}
                                {question.allowedLanguages.length > 3 && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    +{question.allowedLanguages.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAddQuestion(question.id)}
                              disabled={isPending}
                              className="shrink-0"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collection Details</CardTitle>
          <CardDescription>
            {collection.description || "No description provided"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {collection.tags && collection.tags.length > 0 ? (
              collection.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">No tags</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Created on {format(collection.createdAt, "MMMM d, yyyy")}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold">{total}</span> question
            {total !== 1 ? "s" : ""} in this collection
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>
            Browse all questions in this collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No questions in this collection yet.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Languages</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell className="font-medium">
                        {question.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getDifficultyColor(question.difficulty)}
                        >
                          {question.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {question.allowedLanguages.slice(0, 3).map((lang) => (
                            <Badge
                              key={lang}
                              variant="secondary"
                              className="text-xs"
                            >
                              {lang}
                            </Badge>
                          ))}
                          {question.allowedLanguages.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{question.allowedLanguages.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove Question
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "
                                {question.title}" from this collection? This
                                action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleRemoveQuestion(question.id)
                                }
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            handlePageChange(Math.max(1, currentPage - 1))
                          }
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        // Show first page, last page, current page, and pages around current
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => handlePageChange(page)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        } else if (
                          page === currentPage - 2 ||
                          page === currentPage + 2
                        ) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }
                        return null;
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            handlePageChange(
                              Math.min(totalPages, currentPage + 1),
                            )
                          }
                          className={
                            currentPage === totalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
