"use client";

import {
  Edit,
  FileUp,
  MoreHorizontal,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { deleteUser } from "@/actions/user-management";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AddUserDialog from "./add-user-dialog";
import BulkImportDialog from "./bulk-import-dialog";
import EditUserDialog from "./edit-user-dialog";

export interface User {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  gender: "male" | "female" | "other";
  branch: string;
  semester: string;
  section: string;
  regulation: string;
  role: "student" | "instructor" | "admin";
  createdAt: Date;
  banned: boolean | null;
  dateOfBirth?: Date;
}

interface UserManagementClientProps {
  users: User[];
}

const _roleColors: Record<string, string> = {
  student: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  instructor:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const branchColors: Record<string, string> = {
  CSE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  DS: "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  CS: "bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400",
  IT: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400",
  AERO: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
  MECH: "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-400",
  "AI/ML": "bg-pink-100 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400",
  CIVIL: "bg-stone-100 text-stone-700 dark:bg-stone-950/30 dark:text-stone-400",
  EEE: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  ECE: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  ADMIN:
    "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 font-bold",
  EXAM: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400",
};

export default function UserManagementClient({
  users: initialUsers,
}: UserManagementClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.rollNo.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesBranch =
        branchFilter === "all" || user.branch === branchFilter;
      const matchesSemester =
        semesterFilter === "all" || user.semester === semesterFilter;
      return matchesSearch && matchesBranch && matchesSemester;
    });
  }, [users, search, branchFilter, semesterFilter]);

  const branches = useMemo(() => {
    return [...new Set(users.map((u) => u.branch).filter(Boolean))].sort();
  }, [users]);

  const semesters = useMemo(() => {
    return [...new Set(users.map((u) => u.semester).filter(Boolean))].sort();
  }, [users]);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;
    try {
      const result = await deleteUser(selectedUser.id);
      if (result.error) {
        // toast.error(result.error);
        return;
      }
      setUsers(users.filter((u) => u.id !== selectedUser.id));
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Failed to delete user", error);
    }
  };

  const handleUserAdded = (newUser: User) => {
    setUsers([newUser, ...users]);
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(users.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleBulkImport = (newUsers: User[]) => {
    setUsers([...newUsers, ...users]);
  };

  const stats = useMemo(() => {
    return {
      total: users.length,
      students: users.filter((u) => u.role === "student").length,
      instructors: users.filter((u) => u.role === "instructor").length,
      admins: users.filter((u) => u.role === "admin").length,
    };
  }, [users]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              User Management
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage all users in the system
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
              <FileUp className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg border bg-muted/30">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
          <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
            <p className="text-2xl font-bold text-blue-600">{stats.students}</p>
            <p className="text-sm text-muted-foreground">Students</p>
          </div>
          <div className="p-4 rounded-lg border bg-purple-50 dark:bg-purple-950/20">
            <p className="text-2xl font-bold text-purple-600">
              {stats.instructors}
            </p>
            <p className="text-sm text-muted-foreground">Instructors</p>
          </div>
          <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-950/20">
            <p className="text-2xl font-bold text-red-600">{stats.admins}</p>
            <p className="text-sm text-muted-foreground">Admins</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, roll no, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {branch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesters.map((sem) => (
                <SelectItem key={sem} value={sem}>
                  Sem {sem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-center">Sem</TableHead>
                <TableHead className="text-center">Section</TableHead>
                <TableHead>Regulation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No users found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user, index) => (
                  <TableRow key={user.id} className="hover:bg-muted/30">
                    <TableCell className="text-center text-muted-foreground font-mono text-sm">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-sm font-medium">
                        {user.rollNo}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-medium text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={branchColors[user.branch] || "bg-gray-100"}
                      >
                        {user.branch}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {user.semester}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-muted font-medium text-sm">
                        {user.section}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.regulation}
                    </TableCell>
                    <TableCell>
                      {user.banned ? (
                        <Badge variant="destructive" className="text-xs">
                          Banned
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20"
                        >
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(user)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        {filteredUsers.length > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <p>
              Showing {filteredUsers.length} of {users.length} users
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddUserDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onUserAdded={handleUserAdded}
      />

      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImport={handleBulkImport}
      />

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{selectedUser?.name}</strong> ({selectedUser?.rollNo})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
