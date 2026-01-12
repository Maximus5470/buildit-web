"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createUser } from "@/actions/user-management";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "./user-management-client";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded: (user: User) => void;
}

const branches = [
  "CSE",
  "DS",
  "CS",
  "IT",
  "AERO",
  "MECH",
  "AI/ML",
  "CIVIL",
  "EEE",
  "ECE",
];
const semesters = ["1", "2", "3", "4", "5", "6", "7", "8"];
const sections = ["A", "B", "C", "D", "E", "F", "G"];
const regulations = ["R23", "R25"];

interface FormErrors {
  rollNo?: string;
  name?: string;
  email?: string;
}

export default function AddUserDialog({
  open,
  onOpenChange,
  onUserAdded,
}: AddUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    rollNo: "",
    name: "",
    email: "",
    gender: "male" as "male" | "female" | "other",
    branch: "CSE",
    semester: "1",
    section: "A",
    regulation: "R23",
    role: "student" as "student" | "instructor" | "admin",
    dateOfBirth: undefined as Date | undefined,
  });

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) {
      setFormData((prev) => ({ ...prev, dateOfBirth: undefined }));
      return;
    }
    const date = new Date(value);
    setFormData((prev) => ({ ...prev, dateOfBirth: date }));
  };

  const generateEmail = (rollNo: string) => {
    return `${rollNo.toLowerCase()}@iare.ac.in`;
  };

  const isStudent = formData.role === "student";

  const getEmail = () => {
    if (isStudent) {
      return formData.rollNo ? generateEmail(formData.rollNo) : "";
    }
    return formData.email;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (isStudent) {
      if (!formData.rollNo.trim()) {
        newErrors.rollNo = "Roll No is required";
      }
      if (!formData.name.trim()) {
        newErrors.name = "Student Name is required";
      }
    } else {
      if (!formData.name.trim()) {
        newErrors.name = "Name is required";
      }
      if (!formData.email.trim()) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Invalid email format";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    validateForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({ rollNo: true, name: true, email: true });

    if (!validateForm()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setLoading(true);
    try {
      const result = await createUser({
        rollNo: isStudent ? formData.rollNo.toUpperCase() : undefined,
        name: formData.name,
        email: getEmail(),
        gender: formData.gender,
        branch: isStudent ? formData.branch : "N/A",
        semester: isStudent ? formData.semester : "N/A",
        section: isStudent ? formData.section : "N/A",
        regulation: isStudent ? formData.regulation : "N/A",
        role: formData.role,
        dateOfBirth: formData.dateOfBirth,
      });

      if (result.error || !result.user) {
        throw new Error(result.error || "Failed to create user");
      }

      const newUser = result.user;

      await new Promise((resolve) => setTimeout(resolve, 500));

      onUserAdded(newUser as User);
      toast.success(`User "${formData.name}" created with default password`);
      onOpenChange(false);

      // Reset form
      setFormData({
        rollNo: "",
        name: "",
        email: "",
        gender: "male",
        branch: "CSE",
        semester: "1",
        section: "A",
        regulation: "R23",
        role: "student",
        dateOfBirth: undefined,
      });
      setErrors({});
      setTouched({});
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create user",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. Default password:{" "}
            <code className="bg-muted px-1 rounded">password1234</code>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Selection - Prominent */}
          <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
            <Label className="text-sm font-semibold">User Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(v) => {
                setFormData({
                  ...formData,
                  role: v as "student" | "instructor" | "admin",
                });
                setErrors({});
                setTouched({});
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="instructor">Instructor / Faculty</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isStudent
                ? "Students will have auto-generated email from Roll No"
                : "Faculty/Admin can have custom email address"}
            </p>
          </div>

          {isStudent ? (
            <>
              {/* Student Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rollNo">Roll No *</Label>
                  <Input
                    id="rollNo"
                    placeholder="23951A0520"
                    value={formData.rollNo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rollNo: e.target.value.toUpperCase(),
                      })
                    }
                    onBlur={() => handleBlur("rollNo")}
                    className={`uppercase ${touched.rollNo && errors.rollNo ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {touched.rollNo && errors.rollNo && (
                    <p className="text-xs text-red-500">{errors.rollNo}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email (auto-generated)</Label>
                  <Input
                    value={
                      formData.rollNo ? generateEmail(formData.rollNo) : ""
                    }
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Student Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  onBlur={() => handleBlur("name")}
                  className={
                    touched.name && errors.name
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                />
                {touched.name && errors.name && (
                  <p className="text-xs text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        gender: v as "male" | "female" | "other",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select
                    value={formData.branch}
                    onValueChange={(v) =>
                      setFormData({ ...formData, branch: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select
                    value={formData.semester}
                    onValueChange={(v) =>
                      setFormData({ ...formData, semester: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {semesters.map((s) => (
                        <SelectItem key={s} value={s}>
                          Sem {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={formData.section}
                    onValueChange={(v) =>
                      setFormData({ ...formData, section: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Regulation</Label>
                <Select
                  value={formData.regulation}
                  onValueChange={(v) =>
                    setFormData({ ...formData, regulation: v })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regulations.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={
                      formData.dateOfBirth
                        ? format(formData.dateOfBirth, "yyyy-MM-dd")
                        : ""
                    }
                    onChange={handleDateChange}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Faculty/Admin Fields */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Dr. John Smith"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  onBlur={() => handleBlur("name")}
                  className={
                    touched.name && errors.name
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                />
                {touched.name && errors.name && (
                  <p className="text-xs text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.smith@iare.ac.in"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  onBlur={() => handleBlur("email")}
                  className={
                    touched.email && errors.email
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                />
                {touched.email && errors.email && (
                  <p className="text-xs text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      gender: v as "male" | "female" | "other",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={
                      formData.dateOfBirth
                        ? format(formData.dateOfBirth, "yyyy-MM-dd")
                        : ""
                    }
                    onChange={handleDateChange}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
            </>
          )}

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
