"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Import, Plus, Trash2, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { createExam } from "@/actions/create-exam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ExamConfig } from "@/types/exam-config";

import type { Group, User } from "@/types/user";

// Schema Definition
const examFormSchema = z.object({
  title: z.string().min(2, {
    message: "Title must be at least 2 characters.",
  }),
  description: z.string().optional(),
  duration: z.number().min(5, {
    message: "Duration must be at least 5 minutes.",
  }),
  startTime: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "Invalid start time",
    }),
  endTime: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "Invalid end time",
    }),
  groupSchedules: z
    .array(
      z.object({
        groupId: z.string(),
        startTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
          message: "Invalid start time",
        }),
        endTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
          message: "Invalid end time",
        }),
      }),
    )
    .optional(),
  gradingStrategy: z.enum([
    "standard_20_40_50",
    "linear",
    "difficulty_based",
    "count_based",
  ]),
  // Linear Strategy Fields
  linearMarks: z.number().min(1).optional(),
  // Difficulty Based Fields
  easyCount: z.number().min(0).optional(),
  mediumCount: z.number().min(0).optional(),
  hardCount: z.number().min(0).optional(),
  easyPoints: z.number().min(1).optional(),
  mediumPoints: z.number().min(1).optional(),
  hardPoints: z.number().min(1).optional(),
  // Count Based Fields
  countBasedRules: z
    .array(
      z.object({
        count: z.number().min(0),
        marks: z.number().min(0),
      }),
    )
    .optional(),
  // Partial Grading
  enablePartialPoints: z.boolean().optional(),
  // Manual Points Fields
  selectedProblems: z.array(z.string()).optional(),
  // Assignment Fields
  assignedTo: z.enum(["ALL", "BATCH", "INDIVIDUAL", "GROUPS"]),
  targetBranch: z.string().optional(),
  targetSemester: z.string().optional(),
  targetStudents: z.array(z.string()).optional(),
  selectedGroups: z.array(z.string()).optional(),
});

type ExamFormValues = z.infer<typeof examFormSchema>;

const calculateEndTime = (startTimeStr: string, duration: number) => {
  if (!startTimeStr || !duration) return "";
  try {
    const startDate = new Date(startTimeStr);
    if (Number.isNaN(startDate.getTime())) return "";

    const endDate = new Date(startDate.getTime() + duration * 60000);

    // Format to YYYY-MM-DDTHH:mm
    const pad = (num: number) => String(num).padStart(2, "0");
    const year = endDate.getFullYear();
    const month = pad(endDate.getMonth() + 1);
    const day = pad(endDate.getDate());
    const hours = pad(endDate.getHours());
    const minutes = pad(endDate.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (_e) {
    return "";
  }
};

interface CollectionProp {
  id: string;
  name: string;
  description: string | null;
}

interface ProblemProp {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  collectionId: string | null;
}

interface CreateExamClientProps {
  collections: CollectionProp[];
  problems: ProblemProp[];
  users: User[];
  groups: Group[];
}

export default function CreateExamClient({
  collections,
  problems,
  users,
  groups,
}: CreateExamClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [createdPins, setCreatedPins] = useState<
    { groupName: string; pin: string }[]
  >([]);

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      title: "",
      description: "",
      duration: 60,
      gradingStrategy: "standard_20_40_50",
      linearMarks: 10,
      easyCount: 1,
      mediumCount: 1,
      hardCount: 1,
      easyPoints: 20,
      mediumPoints: 40,
      hardPoints: 50,
      countBasedRules: [
        { count: 5, marks: 100 },
        { count: 3, marks: 70 },
        { count: 1, marks: 40 },
      ],
      enablePartialPoints: true,
      selectedProblems: [],
      assignedTo: "GROUPS",
      targetBranch: "all",
      targetSemester: "all",
      targetStudents: [],
      selectedGroups: [],
      startTime: "",
      endTime: "",
    },
  });

  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const problemsPerPage = 10;

  const gradingStrategy = form.watch("gradingStrategy");
  const assignedTo = form.watch("assignedTo");
  const selectedProblems = form.watch("selectedProblems") || [];

  const filteredProblems = problems.filter((problem) => {
    const matchesSearch =
      problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      problem.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (showSelectedOnly) {
      return matchesSearch && selectedProblems.includes(problem.id);
    }
    return matchesSearch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredProblems.length / problemsPerPage);
  const paginatedProblems = filteredProblems.slice(
    (currentPage - 1) * problemsPerPage,
    currentPage * problemsPerPage,
  );

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleShowSelectedToggle = (checked: boolean) => {
    setShowSelectedOnly(checked);
    setCurrentPage(1);
  };

  const handleImportCollection = () => {
    if (!selectedCollectionId) return;

    // Find problems belonging to this collection
    // Assuming problems have collectionId field (common pattern)
    // If not available in the prop type directly, logic might need adjustment based on real data
    const problemsInCollection = problems.filter(
      (p) => p.collectionId === selectedCollectionId,
    );

    if (problemsInCollection.length === 0) {
      toast.error(
        "No problems found in this collection or collection not linked.",
      );
      return;
    }

    const currentSelected = form.getValues("selectedProblems") || [];
    const newSelected = [...currentSelected];

    problemsInCollection.forEach((p) => {
      if (!newSelected.includes(p.id)) {
        newSelected.push(p.id);
      }
    });

    form.setValue("selectedProblems", newSelected);
    toast.success(
      `Imported ${problemsInCollection.length} problems from collection.`,
    );
    setOpenImportDialog(false);
    setSelectedCollectionId("");
  };

  // Derived lists for filters
  const branches = [
    "CSE",
    "ECE",
    "EEE",
    "MECH",
    "CIVIL",
    "IT",
    "AI/ML",
    "DS",
    "CS",
    "AERO",
  ];
  const semesters = ["1", "2", "3", "4", "5", "6", "7", "8"];

  const _students = users.filter((u) => u.role === "student");

  async function onSubmit(data: ExamFormValues) {
    setIsLoading(true);
    try {
      // Build the ExamConfig based on the selected problems
      const config: ExamConfig = {
        strategy: "fixed",
        problemIds: data.selectedProblems || [],
      };

      // Determine which groups should have access based on assignedTo
      let groupIds: string[] = [];

      if (data.assignedTo === "ALL") {
        // All students: assign all groups
        groupIds = groups.map((g) => g.id);
      } else if (data.assignedTo === "GROUPS") {
        // Specific groups: use selected groups
        if (!data.selectedGroups || data.selectedGroups.length === 0) {
          toast.error("Please select at least one group.");
          setIsLoading(false);
          return;
        }
        groupIds = data.selectedGroups;
      } else if (data.assignedTo === "BATCH") {
        // TODO: Filter groups based on branch/semester
        // For now, this needs proper implementation
        toast.error("BATCH assignment is not yet fully implemented.");
        setIsLoading(false);
        return;
      } else if (data.assignedTo === "INDIVIDUAL") {
        // TODO: Create individual assignments
        // For now, this needs proper implementation
        toast.error("INDIVIDUAL assignment is not yet fully implemented.");
        setIsLoading(false);
        return;
      }

      const result = await createExam({
        title: data.title,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        groupIds: groupIds,
        groupSchedules: data.groupSchedules?.map((gs) => ({
          ...gs,
          startTime: new Date(gs.startTime),
          endTime: new Date(gs.endTime),
        })),
        durationMinutes: data.duration,
        config,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Exam created successfully!");
        if (result.pins && result.pins.length > 0) {
          setCreatedPins(result.pins);
          setShowPinDialog(true);
        } else {
          setTimeout(() => router.push("/exams"), 0);
        }
      }
    } catch (_error) {
      toast.error("Failed to create exam.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Exam</h1>
          <p className="text-muted-foreground mt-2">
            Configure exam details, questions, and participants.
          </p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Exam"}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form className="space-y-8">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="details">Exam Details</TabsTrigger>
              <TabsTrigger value="problems">Problems</TabsTrigger>
              <TabsTrigger value="grading">Grading</TabsTrigger>
              <TabsTrigger value="participants">Participants</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Set the core details for this examination.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exam Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Mid-Term Examination 2024"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter exam instructions or description..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              value={field.value}
                              onChange={(e) => {
                                const newDuration =
                                  parseInt(e.target.value, 10) || 0;
                                field.onChange(newDuration);

                                // Update all batch end times based on new duration
                                const currentSchedules =
                                  form.getValues("groupSchedules") || [];
                                if (currentSchedules.length > 0) {
                                  const updatedSchedules = currentSchedules.map(
                                    (s) => ({
                                      ...s,
                                      endTime: calculateEndTime(
                                        s.startTime,
                                        newDuration,
                                      ),
                                    }),
                                  );
                                  form.setValue(
                                    "groupSchedules",
                                    updatedSchedules,
                                  );
                                }
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="problems" className="space-y-6">
              <Card className="flex flex-col overflow-hidden">
                <CardHeader className="pb-4 border-b space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle>Problem Selection</CardTitle>
                      <CardDescription>
                        Choose problems for this exam.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dialog
                        open={openImportDialog}
                        onOpenChange={setOpenImportDialog}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Import className="h-4 w-4" />
                            Import
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Import Problems</DialogTitle>
                            <DialogDescription>
                              Select a collection to add its problems to this
                              exam.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Select
                              value={selectedCollectionId}
                              onValueChange={setSelectedCollectionId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a collection" />
                              </SelectTrigger>
                              <SelectContent>
                                {collections?.map((collection) => (
                                  <SelectItem
                                    key={collection.id}
                                    value={collection.id}
                                  >
                                    {collection.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setOpenImportDialog(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleImportCollection}
                              disabled={!selectedCollectionId}
                            >
                              Import
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Badge variant="secondary" className="px-3 py-1">
                        {selectedProblems.length} Selected
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <Input
                      placeholder="Search problems..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="w-full sm:max-w-md"
                    />
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="show-selected"
                        checked={showSelectedOnly}
                        onCheckedChange={handleShowSelectedToggle}
                      />
                      <FormLabel
                        htmlFor="show-selected"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Show Selected Only
                      </FormLabel>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden bg-muted/10">
                  <div className="p-4 space-y-3 min-h-[500px]">
                    {paginatedProblems.map((problem) => (
                      <div
                        key={problem.id}
                        className="group flex items-start gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all duration-200"
                      >
                        <FormField
                          control={form.control}
                          name="selectedProblems"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-1 shrink-0">
                              <FormControl>
                                <Checkbox
                                  className="h-5 w-5"
                                  checked={field.value?.includes(problem.id)}
                                  onCheckedChange={(checked) => {
                                    const value = field.value || [];
                                    if (checked) {
                                      field.onChange([...value, problem.id]);
                                    } else {
                                      field.onChange(
                                        value.filter(
                                          (val) => val !== problem.id,
                                        ),
                                      );
                                    }
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="flex-1 min-w-0 grid gap-1">
                          <div className="flex items-start justify-between gap-4">
                            <h4 className="font-semibold text-base leading-tight">
                              {problem.title}
                            </h4>
                            <Badge
                              variant="outline"
                              className={
                                problem.difficulty === "easy"
                                  ? "border-green-500 text-green-600 bg-green-50"
                                  : problem.difficulty === "medium"
                                    ? "border-yellow-500 text-yellow-600 bg-yellow-50"
                                    : "border-red-500 text-red-600 bg-red-50"
                              }
                            >
                              {problem.difficulty}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {problem.description}
                          </p>
                        </div>
                      </div>
                    ))}
                    {filteredProblems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                        <div className="bg-muted/50 p-4 rounded-full mb-4">
                          <Import className="h-8 w-8 opacity-50" />
                        </div>
                        <p className="text-lg font-medium">No problems found</p>
                        <p className="text-sm">
                          Try adjusting your search query.
                        </p>
                      </div>
                    )}
                  </div>
                  {totalPages > 1 && (
                    <div className="border-t p-4 bg-background">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() =>
                                setCurrentPage(Math.max(1, currentPage - 1))
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
                            if (
                              page === 1 ||
                              page === totalPages ||
                              (page >= currentPage - 1 &&
                                page <= currentPage + 1)
                            ) {
                              return (
                                <PaginationItem key={page}>
                                  <PaginationLink
                                    onClick={() => setCurrentPage(page)}
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
                                setCurrentPage(
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="grading" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Grading Strategy</CardTitle>
                      <CardDescription>
                        Choose how student submissions are scored.
                      </CardDescription>
                    </div>
                    <FormField
                      control={form.control}
                      name="enablePartialPoints"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-medium">
                            Partial Credit
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  <FormField
                    control={form.control}
                    name="gradingStrategy"
                    render={({ field }) => (
                      <FormItem className="space-y-4">
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                          >
                            <FormItem>
                              <FormControl>
                                <RadioGroupItem
                                  value="standard_20_40_50"
                                  className="peer sr-only"
                                />
                              </FormControl>
                              <FormLabel className="flex flex-col items-start justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                                <div className="mb-2 text-lg font-semibold">
                                  Standard
                                </div>
                                <div className="text-sm text-muted-foreground leading-snug">
                                  Fixed scoring based on difficulty:
                                  <div className="mt-2 flex gap-2">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Easy: 20
                                    </Badge>
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Med: 40
                                    </Badge>
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Hard: 50
                                    </Badge>
                                  </div>
                                </div>
                              </FormLabel>
                            </FormItem>

                            <FormItem>
                              <FormControl>
                                <RadioGroupItem
                                  value="linear"
                                  className="peer sr-only"
                                />
                              </FormControl>
                              <FormLabel className="flex flex-col items-start justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                                <div className="mb-2 text-lg font-semibold">
                                  Linear
                                </div>
                                <div className="text-sm text-muted-foreground leading-snug">
                                  Every question has the same fixed point value,
                                  regardless of difficulty.
                                </div>
                              </FormLabel>
                            </FormItem>

                            <FormItem>
                              <FormControl>
                                <RadioGroupItem
                                  value="difficulty_based"
                                  className="peer sr-only"
                                />
                              </FormControl>
                              <FormLabel className="flex flex-col items-start justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                                <div className="mb-2 text-lg font-semibold">
                                  Difficulty Based
                                </div>
                                <div className="text-sm text-muted-foreground leading-snug">
                                  Set custom point values for each difficulty
                                  tier (Easy, Medium, Hard).
                                </div>
                              </FormLabel>
                            </FormItem>

                            <FormItem>
                              <FormControl>
                                <RadioGroupItem
                                  value="count_based"
                                  className="peer sr-only"
                                />
                              </FormControl>
                              <FormLabel className="flex flex-col items-start justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                                <div className="mb-2 text-lg font-semibold">
                                  Count Based
                                </div>
                                <div className="text-sm text-muted-foreground leading-snug">
                                  Award total marks based on the number of
                                  questions solved (Thresholds).
                                </div>
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <AnimatePresence mode="wait">
                {gradingStrategy === "linear" && (
                  <motion.div
                    key="linear"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Linear Scoring Configuration</CardTitle>
                        <CardDescription>
                          Set the points awarded for each question.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <FormField
                          control={form.control}
                          name="linearMarks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Points per Question</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value, 10))
                                  }
                                />
                              </FormControl>
                              <FormDescription>
                                Each question will be worth this many points
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {gradingStrategy === "difficulty_based" && (
                  <motion.div
                    key="difficulty"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Difficulty-Based Scoring</CardTitle>
                        <CardDescription>
                          Configure points for each difficulty level.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-6">
                          {["easy", "medium", "hard"].map((difficulty) => (
                            <div
                              key={difficulty}
                              className="flex items-center gap-4 p-4 border rounded-lg"
                            >
                              <Badge
                                variant={
                                  difficulty === "easy"
                                    ? "secondary"
                                    : difficulty === "medium"
                                      ? "default"
                                      : "destructive"
                                }
                                className="min-w-[80px] justify-center"
                              >
                                {difficulty}
                              </Badge>
                              <FormField
                                control={form.control}
                                // @ts-expect-error
                                name={`${difficulty}Points`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel>Points</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        value={field.value as number}
                                        onChange={(e) =>
                                          field.onChange(
                                            parseInt(e.target.value, 10),
                                          )
                                        }
                                        onBlur={field.onBlur}
                                        name={field.name}
                                        ref={field.ref}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {gradingStrategy === "count_based" && (
                  <motion.div
                    key="count"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>Count-Based Scoring Rules</CardTitle>
                        <CardDescription>
                          Define thresholds: solving X questions awards Y marks.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                            <div>Questions Solved</div>
                            <div>Marks Awarded</div>
                          </div>
                          <FormField
                            control={form.control}
                            name="countBasedRules"
                            render={({ field }) => (
                              <FormItem>
                                <div className="space-y-3">
                                  {(field.value || []).map((rule, index) => (
                                    <div
                                      key={rule.count}
                                      className="grid grid-cols-2 gap-4 items-center"
                                    >
                                      <Input
                                        type="number"
                                        value={rule.count}
                                        onChange={(e) => {
                                          const newRules = [
                                            ...(field.value || []),
                                          ];
                                          newRules[index] = {
                                            ...rule,
                                            count:
                                              parseInt(e.target.value, 10) || 0,
                                          };
                                          field.onChange(newRules);
                                        }}
                                        placeholder="e.g., 5"
                                      />
                                      <div className="flex gap-2">
                                        <Input
                                          type="number"
                                          value={rule.marks}
                                          onChange={(e) => {
                                            const newRules = [
                                              ...(field.value || []),
                                            ];
                                            newRules[index] = {
                                              ...rule,
                                              marks:
                                                parseInt(e.target.value, 10) ||
                                                0,
                                            };
                                            field.onChange(newRules);
                                          }}
                                          placeholder="e.g., 100"
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            const newRules = (
                                              field.value || []
                                            ).filter((_, i) => i !== index);
                                            field.onChange(newRules);
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      field.onChange([
                                        ...(field.value || []),
                                        { count: 0, marks: 0 },
                                      ]);
                                    }}
                                    className="w-full"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Rule
                                  </Button>
                                </div>
                                <FormDescription>
                                  Example: If student solves ≥5 questions, they
                                  get 100 marks
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="participants" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle>Exam Participants</CardTitle>
                  </div>
                  <CardDescription>
                    Who is this exam assigned to?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="assignedTo"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Assignment Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="ALL" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                All Students
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="BATCH" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Specific Branch/Semester
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="INDIVIDUAL" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Individual Students
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="GROUPS" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Student Groups
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {assignedTo === "GROUPS" && (
                    <div className="pl-6 border-l-2 space-y-4">
                      <FormLabel>Select Groups and Schedule</FormLabel>
                      <div className="border rounded-md overflow-hidden">
                        <ScrollArea className="h-[300px]">
                          <div className="p-4 space-y-4">
                            {groups.map((group) => {
                              const isSelected = form
                                .watch("selectedGroups")
                                ?.includes(group.id);
                              return (
                                <div
                                  key={group.id}
                                  className="space-y-4 p-4 border rounded-lg bg-card/50"
                                >
                                  <FormField
                                    control={form.control}
                                    name="selectedGroups"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 hover:bg-muted/50 rounded-sm">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(
                                              group.id,
                                            )}
                                            onCheckedChange={(checked) => {
                                              const value: string[] =
                                                field.value || [];
                                              let newValue: string[];
                                              if (checked) {
                                                newValue = [...value, group.id];
                                              } else {
                                                newValue = value.filter(
                                                  (val) => val !== group.id,
                                                );
                                              }
                                              field.onChange(newValue);

                                              // Manage groupSchedules sync
                                              const currentSchedules =
                                                form.getValues(
                                                  "groupSchedules",
                                                ) || [];
                                              if (checked) {
                                                if (
                                                  !currentSchedules.find(
                                                    (s) =>
                                                      s.groupId === group.id,
                                                  )
                                                ) {
                                                  form.setValue(
                                                    "groupSchedules",
                                                    [
                                                      ...currentSchedules,
                                                      {
                                                        groupId: group.id,
                                                        startTime: "",
                                                        endTime: "",
                                                      },
                                                    ],
                                                  );
                                                }
                                              } else {
                                                form.setValue(
                                                  "groupSchedules",
                                                  currentSchedules.filter(
                                                    (s) =>
                                                      s.groupId !== group.id,
                                                  ),
                                                );
                                              }
                                            }}
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none min-w-0">
                                          <FormLabel className="font-medium truncate block">
                                            {group.name}
                                          </FormLabel>
                                          {group.description && (
                                            <p className="text-xs text-muted-foreground truncate">
                                              {group.description}
                                            </p>
                                          )}
                                        </div>
                                      </FormItem>
                                    )}
                                  />

                                  {isSelected && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-9">
                                      <FormField
                                        control={form.control}
                                        name="groupSchedules"
                                        render={({ field }) => {
                                          const scheduleIdx =
                                            field.value?.findIndex(
                                              (s) => s.groupId === group.id,
                                            );
                                          if (
                                            scheduleIdx === undefined ||
                                            scheduleIdx === -1
                                          )
                                            // biome-ignore lint/complexity/noUselessFragments: Required for types
                                            return <></>;

                                          return (
                                            <FormItem>
                                              <FormLabel className="text-xs">
                                                Start Time
                                              </FormLabel>
                                              <FormControl>
                                                <Input
                                                  type="datetime-local"
                                                  value={
                                                    field.value?.[scheduleIdx]
                                                      ?.startTime || ""
                                                  }
                                                  onChange={(e) => {
                                                    const newSchedules = [
                                                      ...(field.value || []),
                                                    ];
                                                    const startTime =
                                                      e.target.value;
                                                    const duration =
                                                      form.getValues(
                                                        "duration",
                                                      );
                                                    const endTime =
                                                      calculateEndTime(
                                                        startTime,
                                                        duration,
                                                      );

                                                    newSchedules[scheduleIdx] =
                                                      {
                                                        ...newSchedules[
                                                          scheduleIdx
                                                        ],
                                                        startTime,
                                                        endTime,
                                                      };

                                                    field.onChange(
                                                      newSchedules,
                                                    );
                                                  }}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          );
                                        }}
                                      />
                                      <FormField
                                        control={form.control}
                                        name="groupSchedules"
                                        render={({ field }) => {
                                          const scheduleIdx =
                                            field.value?.findIndex(
                                              (s) => s.groupId === group.id,
                                            );
                                          if (
                                            scheduleIdx === undefined ||
                                            scheduleIdx === -1
                                          )
                                            // biome-ignore lint/complexity/noUselessFragments: Required for types
                                            return <></>;

                                          return (
                                            <FormItem>
                                              <FormLabel className="text-xs">
                                                End Time
                                              </FormLabel>
                                              <FormControl>
                                                <Input
                                                  type="datetime-local"
                                                  value={
                                                    field.value?.[scheduleIdx]
                                                      ?.endTime || ""
                                                  }
                                                  onChange={(e) => {
                                                    const newSchedules = [
                                                      ...(field.value || []),
                                                    ];
                                                    newSchedules[scheduleIdx] =
                                                      {
                                                        ...newSchedules[
                                                          scheduleIdx
                                                        ],
                                                        endTime: e.target.value,
                                                      };
                                                    field.onChange(
                                                      newSchedules,
                                                    );
                                                  }}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          );
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Selected {form.watch("selectedGroups")?.length || 0} of{" "}
                        {groups.length} groups
                      </p>
                    </div>
                  )}

                  {assignedTo === "BATCH" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2">
                      <FormField
                        control={form.control}
                        name="targetBranch"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Branch</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">
                                  All Branches
                                </SelectItem>
                                {branches.map((b) => (
                                  <SelectItem key={b} value={b}>
                                    {b}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="targetSemester"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Semester</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select semester" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">
                                  All Semesters
                                </SelectItem>
                                {semesters.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    Semester {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {assignedTo === "INDIVIDUAL" && (
                    <div className="pl-6 border-l-2 space-y-4">
                      <FormLabel>Select Students</FormLabel>
                      <div className="border rounded-md overflow-hidden">
                        <ScrollArea className="h-[300px]">
                          <div className="p-4 space-y-2">
                            {users?.map((student) => (
                              <FormField
                                key={student.id}
                                control={form.control}
                                name="targetStudents"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 hover:bg-muted/50 rounded-sm">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(
                                          student.id,
                                        )}
                                        onCheckedChange={(checked) => {
                                          const value = field.value || [];
                                          if (checked) {
                                            field.onChange([
                                              ...value,
                                              student.id,
                                            ]);
                                          } else {
                                            field.onChange(
                                              value.filter(
                                                (val) => val !== student.id,
                                              ),
                                            );
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none min-w-0">
                                      <FormLabel className="font-normal truncate block">
                                        {student.name} ({student.rollNo})
                                      </FormLabel>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {student.branch} - Sem{" "}
                                        {student.semester}
                                      </p>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Selected: {form.watch("targetStudents")?.length || 0}{" "}
                        students
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>

      <Dialog
        open={showPinDialog}
        onOpenChange={(open) => {
          if (!open) router.push("/exams");
          setShowPinDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exam Created Successfully!</DialogTitle>
            <DialogDescription>
              The following PINs have been generated for each batch. Please
              share these with the respective students.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createdPins.map((item) => (
              <div
                key={item.pin}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
              >
                <div>
                  <p className="text-sm font-medium">{item.groupName}</p>
                  <p className="font-mono text-2xl font-bold tracking-widest text-primary">
                    {item.pin}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${item.groupName} - ${item.pin}`,
                    );
                    toast.success(`PIN for ${item.groupName} copied!`);
                  }}
                >
                  Copy
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => router.push("/exams")}>Go to Exams</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
