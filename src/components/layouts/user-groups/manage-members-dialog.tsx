"use client";

import { Search, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface ManageMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  users: User[];
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
}

export default function ManageMembersDialog({
  open,
  onOpenChange,
  group,
  users,
  onAddMember,
  onRemoveMember,
}: ManageMembersDialogProps) {
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const enrolledUserIds = useMemo(() => {
    if (!group) return new Set<string>();
    return new Set(group.members.map((m) => m.userId));
  }, [group]);

  const filteredUsers = useMemo(() => {
    const query = memberSearchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.rollNumber?.toLowerCase().includes(query),
    );
  }, [users, memberSearchQuery]);

  const membersList = useMemo(() => {
    if (!group) return [];
    return users.filter((u) => enrolledUserIds.has(u.id));
  }, [users, enrolledUserIds, group]);

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>Manage Group Members</DialogTitle>
          <DialogDescription>
            Add or remove users from{" "}
            <span className="font-semibold text-primary">{group.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 px-6 pb-4">
          <Tabs defaultValue="all" className="flex-1 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-4">
                <TabsList>
                  <TabsTrigger value="all">All Users</TabsTrigger>
                  <TabsTrigger value="members">
                    Current Members ({enrolledUserIds.size})
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or roll no..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <TabsContent
              value="all"
              className="flex-1 mt-0 min-h-0 flex flex-col border rounded-md bg-muted/20 overflow-hidden"
            >
              <ScrollArea className="flex-1 h-full">
                <div className="p-2 space-y-1">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found.
                    </div>
                  ) : (
                    filteredUsers.map((user) => {
                      const isMember = enrolledUserIds.has(user.id);
                      return (
                        <div
                          key={user.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            isMember
                              ? "bg-primary/5 border-primary/20"
                              : "bg-background hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium truncate">
                                {user.name || "Unnamed User"}
                              </p>
                              {isMember && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] py-0 h-5 shrink-0"
                                >
                                  Member
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p className="truncate">{user.email}</p>
                              <p className="truncate">
                                {user.rollNumber || "No Roll"} •{" "}
                                {user.branch || "No Branch"} • Sem{" "}
                                {user.semester || "-"}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isMember ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 h-8"
                                onClick={() => onRemoveMember(user.id)}
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Remove
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8"
                                onClick={() => onAddMember(user.id)}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="members"
              className="flex-1 mt-0 min-h-0 flex flex-col border rounded-md bg-muted/20 overflow-hidden"
            >
              <ScrollArea className="flex-1 h-full">
                <div className="p-2 space-y-1">
                  {membersList.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No members in this group yet.
                    </div>
                  ) : (
                    membersList
                      .filter((user) =>
                        memberSearchQuery
                          ? user.name
                              ?.toLowerCase()
                              .includes(memberSearchQuery.toLowerCase()) ||
                            user.email
                              .toLowerCase()
                              .includes(memberSearchQuery.toLowerCase()) ||
                            user.rollNumber
                              ?.toLowerCase()
                              .includes(memberSearchQuery.toLowerCase())
                          : true,
                      )
                      .map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/50"
                        >
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="text-sm font-medium truncate">
                              {user.name || "Unnamed User"}
                            </p>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p className="truncate">{user.email}</p>
                              <p className="truncate">
                                {user.rollNumber || "No Roll"} •{" "}
                                {user.branch || "No Branch"} • Sem{" "}
                                {user.semester || "-"}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => onRemoveMember(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-6 pt-2 shrink-0">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
