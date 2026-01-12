"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Edit2, Plus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  addUserToGroup,
  createUserGroup,
  deleteUserGroup,
  removeUserFromGroup,
  updateUserGroup,
} from "@/actions/user-groups";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import ManageMembersDialog from "./manage-members-dialog";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  rollNumber?: string | null;
  branch?: string | null;
  semester?: string | null;
}

interface GroupMember {
  userId: string;
  groupId: string;
  joinedAt: Date;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  members: GroupMember[];
}

interface UserGroupsClientProps {
  groups: Group[];
  users: User[];
}

const groupFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

export default function UserGroupsClient({
  groups: initialGroups,
  users,
}: UserGroupsClientProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const createForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: "",
      description: "",
      memberIds: [],
    },
  });

  const editForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  async function onCreateSubmit(data: GroupFormValues) {
    setIsLoading(true);
    try {
      const result = await createUserGroup(data);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Group created successfully!");
        setIsCreateDialogOpen(false);
        createForm.reset();
        router.refresh();
      }
    } catch (_error) {
      toast.error("Failed to create group");
    } finally {
      setIsLoading(false);
    }
  }

  async function onEditSubmit(data: GroupFormValues) {
    if (!selectedGroup) return;

    setIsLoading(true);
    try {
      const result = await updateUserGroup({
        id: selectedGroup.id,
        name: data.name,
        description: data.description,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Group updated successfully!");
        setIsEditDialogOpen(false);
        setSelectedGroup(null);
        editForm.reset();
        router.refresh();
      }
    } catch (_error) {
      toast.error("Failed to update group");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteGroup() {
    if (!groupToDelete) return;

    setIsLoading(true);
    try {
      const result = await deleteUserGroup(groupToDelete);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Group deleted successfully!");
        setIsDeleteDialogOpen(false);
        setGroupToDelete(null);
        router.refresh();
      }
    } catch (_error) {
      toast.error("Failed to delete group");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddMember(userId: string) {
    if (!selectedGroup) return;

    // Optimistic update
    const updatedGroups = groups.map((g) => {
      if (g.id === selectedGroup.id) {
        return {
          ...g,
          members: [
            ...g.members,
            { userId, groupId: g.id, joinedAt: new Date() },
          ],
        };
      }
      return g;
    });
    setGroups(updatedGroups);
    // Also update selectedGroup so UI reflects change immediately
    const updatedSelectedGroup = {
      ...selectedGroup,
      members: [
        ...selectedGroup.members,
        { userId, groupId: selectedGroup.id, joinedAt: new Date() },
      ],
    };
    setSelectedGroup(updatedSelectedGroup);

    try {
      const result = await addUserToGroup(selectedGroup.id, userId);
      if (result.error) {
        toast.error(result.error);
        // Revert on error
        router.refresh();
      } else {
        toast.success("Member added successfully!");
        router.refresh();
      }
    } catch (_error) {
      toast.error("Failed to add member");
      router.refresh();
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedGroup) return;

    // Optimistic update
    const updatedGroups = groups.map((g) => {
      if (g.id === selectedGroup.id) {
        return {
          ...g,
          members: g.members.filter((m) => m.userId !== userId),
        };
      }
      return g;
    });
    setGroups(updatedGroups);
    // Update selectedGroup
    const updatedSelectedGroup = {
      ...selectedGroup,
      members: selectedGroup.members.filter((m) => m.userId !== userId),
    };
    setSelectedGroup(updatedSelectedGroup);

    try {
      const result = await removeUserFromGroup(selectedGroup.id, userId);
      if (result.error) {
        toast.error(result.error);
        router.refresh();
      } else {
        toast.success("Member removed successfully!");
        router.refresh();
      }
    } catch (_error) {
      toast.error("Failed to remove member");
      router.refresh();
    }
  }

  function openEditDialog(group: Group) {
    setSelectedGroup(group);
    editForm.setValue("name", group.name);
    editForm.setValue("description", group.description || "");
    setIsEditDialogOpen(true);
  }

  function openMembersDialog(group: Group) {
    setSelectedGroup(group);
    setIsMembersDialogOpen(true);
  }

  // Effect to sync state when props change (router.refresh results)
  useEffect(() => {
    setGroups(initialGroups);
    if (selectedGroup) {
      // If we have a selected group open, update it with fresh data
      const freshGroup = initialGroups.find((g) => g.id === selectedGroup.id);
      if (freshGroup) {
        setSelectedGroup(freshGroup);
      }
    }
  }, [initialGroups, selectedGroup]);

  // Removed filters as they are now handled in the dialog component

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Groups</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage student groups for exam assignments
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create User Group</DialogTitle>
              <DialogDescription>
                Create a new group and optionally add members
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit(onCreateSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., CSE 2024 Batch A"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe this group..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="memberIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Members (Optional)</FormLabel>
                      <ScrollArea className="h-[200px] border rounded-md p-4">
                        <div className="space-y-2">
                          {users.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                checked={field.value?.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  const value = field.value || [];
                                  if (checked) {
                                    field.onChange([...value, user.id]);
                                  } else {
                                    field.onChange(
                                      value.filter((id) => id !== user.id),
                                    );
                                  }
                                }}
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {user.name || user.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {user.rollNumber || "No Roll No"} •{" "}
                                  {user.branch || "N/A"} • Sem{" "}
                                  {user.semester || "N/A"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Creating..." : "Create Group"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <Card key={group.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl">{group.name}</CardTitle>
                  {group.description && (
                    <CardDescription className="mt-2 text-sm line-clamp-2">
                      {group.description}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {group.members.length} Members
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openMembersDialog(group)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Members
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(group)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setGroupToDelete(group.id);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Groups Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first user group to organize students for exams
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Group
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update group name and description
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <ManageMembersDialog
        open={isMembersDialogOpen}
        onOpenChange={setIsMembersDialogOpen}
        group={selectedGroup}
        users={users}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this group and remove all member
              associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGroupToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
