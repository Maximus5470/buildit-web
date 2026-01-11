"use client";

import {
  AlertCircle,
  CheckCircle,
  Download,
  FileUp,
  Loader2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User } from "./user-management-client";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (users: User[]) => void;
}

interface ParsedUser {
  rollNo: string;
  name: string;
  gender: "male" | "female" | "other";
  branch: string;
  semester: string;
  section: string;
  regulation: string;
  error?: string;
}

const CSV_TEMPLATE = `roll_no,student_name,gender,branch,semester,section,regulation
23951A0501,John Doe,male,CSE,5,A,R22
23951A0502,Jane Smith,female,CSE,5,A,R22
23951A0503,Bob Wilson,male,ECE,5,B,R22`;

export default function BulkImportDialog({
  open,
  onOpenChange,
  onImport,
}: BulkImportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateEmail = (rollNo: string) => {
    return `${rollNo.toLowerCase()}@iare.ac.in`;
  };

  const parseCSV = useCallback((content: string): ParsedUser[] => {
    const lines = content.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0]
      .toLowerCase()
      .split(",")
      .map((h) => h.trim());
    const rollNoIdx = headers.findIndex((h) => h.includes("roll"));
    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const genderIdx = headers.findIndex((h) => h.includes("gender"));
    const branchIdx = headers.findIndex((h) => h.includes("branch"));
    const semesterIdx = headers.findIndex(
      (h) => h.includes("semester") || h.includes("sem"),
    );
    const sectionIdx = headers.findIndex(
      (h) => h.includes("section") || h.includes("sec"),
    );
    const regulationIdx = headers.findIndex(
      (h) => h.includes("regulation") || h.includes("reg"),
    );

    if (rollNoIdx === -1 || nameIdx === -1) {
      toast.error("CSV must have roll_no and student_name columns");
      return [];
    }

    const users: ParsedUser[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length < 2) continue;

      const rollNo = values[rollNoIdx]?.toUpperCase() || "";
      const name = values[nameIdx] || "";
      const genderRaw = values[genderIdx]?.toLowerCase() || "male";
      const gender = ["male", "female", "other"].includes(genderRaw)
        ? (genderRaw as "male" | "female" | "other")
        : "male";
      const branch = values[branchIdx]?.toUpperCase() || "CSE";
      const semester = values[semesterIdx] || "1";
      const section = values[sectionIdx]?.toUpperCase() || "A";
      const regulation = values[regulationIdx]?.toUpperCase() || "R22";

      users.push({
        rollNo,
        name,
        gender,
        branch,
        semester,
        section,
        regulation,
        error: !rollNo || !name ? "Missing required field" : undefined,
      });
    }

    return users;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast.error("Please upload a CSV file");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const users = parseCSV(content);
        setParsedUsers(users);
        if (users.length > 0) {
          toast.success(`Parsed ${users.length} students from CSV`);
        }
      };
      reader.readAsText(file);
    },
    [parseCSV],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    const validUsers = parsedUsers.filter((u) => !u.error);
    if (validUsers.length === 0) {
      toast.error("No valid users to import");
      return;
    }

    setLoading(true);
    try {
      const newUsers: User[] = validUsers.map((u) => ({
        id: crypto.randomUUID(),
        rollNo: u.rollNo,
        name: u.name,
        email: generateEmail(u.rollNo),
        gender: u.gender,
        branch: u.branch,
        semester: u.semester,
        section: u.section,
        regulation: u.regulation,
        role: "student" as const,
        createdAt: new Date(),
        banned: false,
      }));

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      onImport(newUsers);
      toast.success(`Successfully imported ${newUsers.length} students`);
      onOpenChange(false);
      setParsedUsers([]);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to import users";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validCount = parsedUsers.filter((u) => !u.error).length;
  const errorCount = parsedUsers.filter((u) => u.error).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import Students</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple students at once.
            <br />
            Email:{" "}
            <code className="bg-muted px-1 rounded">roll_no@iare.ac.in</code> |
            Password:{" "}
            <code className="bg-muted px-1 rounded">password1234</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          {/* Expected Columns */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
            <p className="font-medium mb-1">Required columns:</p>
            <code>
              roll_no, student_name, gender, branch, semester, section,
              regulation
            </code>
          </div>

          {/* Drop Zone */}
          <section
            aria-label="CSV file drop zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground"
            }`}
          >
            <FileUp className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop your CSV file here, or
            </p>
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
              <Button variant="outline" size="sm" asChild>
                <span>Browse Files</span>
              </Button>
            </label>
          </section>

          {/* Preview */}
          {parsedUsers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Preview</p>
                <Badge variant="secondary">{validCount} valid</Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} errors</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-xs"
                  onClick={() => setParsedUsers([])}
                >
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-40 border rounded-lg">
                <div className="p-2 space-y-1">
                  {parsedUsers.map((user) => (
                    <div
                      key={user.rollNo}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        user.error ? "bg-destructive/10" : "bg-muted/50"
                      }`}
                    >
                      {user.error ? (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      )}
                      <code className="text-xs">{user.rollNo}</code>
                      <span className="flex-1 truncate">{user.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {user.branch}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {user.section}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={loading || validCount === 0}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Import {validCount} Students
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
