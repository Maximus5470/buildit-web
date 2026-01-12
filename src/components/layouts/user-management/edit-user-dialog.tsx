"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import type { User } from "./user-management-client";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUserUpdated: (user: User) => void;
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

export default function EditUserDialog({
  open,
  onOpenChange,
  user,
  onUserUpdated,
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    gender: "male" as "male" | "female" | "other",
    branch: "CSE",
    semester: "1",
    section: "A",
    regulation: "R23",
    role: "student" as "student" | "instructor" | "admin",
    banned: false,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        gender: user.gender,
        branch: user.branch,
        semester: user.semester,
        section: user.section,
        regulation: user.regulation,
        role: user.role,
        banned: user.banned || false,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    setLoading(true);
    try {
      const { updateUser } = await import("@/actions/user-management");

      const result = await updateUser({
        id: user.id,
        name: formData.name,
        role: formData.role,
        banned: formData.banned,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update user");
      }

      const updatedUser: User = {
        ...user,
        name: formData.name,
        gender: formData.gender,
        branch: formData.branch,
        semester: formData.semester,
        section: formData.section,
        regulation: formData.regulation,
        role: formData.role,
        banned: formData.banned,
      };

      onUserUpdated(updatedUser);
      toast.success(
        formData.banned ? "User has been banned" : "User updated successfully",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update user",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information for{" "}
            <code className="bg-muted px-1 rounded">{user?.rollNo}</code>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Roll No</Label>
              <Input value={user?.rollNo || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-name">Student Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
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
                onValueChange={(v) => setFormData({ ...formData, branch: v })}
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
              <Label>Regulation</Label>
              <Select
                value={formData.regulation}
                onValueChange={(v) =>
                  setFormData({ ...formData, regulation: v })
                }
              >
                <SelectTrigger>
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
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select
                value={formData.semester}
                onValueChange={(v) => setFormData({ ...formData, semester: v })}
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
                onValueChange={(v) => setFormData({ ...formData, section: v })}
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
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    role: v as "student" | "instructor" | "admin",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="instructor">Instructor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t pt-4">
            <div>
              <Label htmlFor="banned">Ban User</Label>
              <p className="text-xs text-muted-foreground">
                Banned users cannot log in
              </p>
            </div>
            <Switch
              id="banned"
              checked={formData.banned}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, banned: checked })
              }
            />
          </div>

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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
