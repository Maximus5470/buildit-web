"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import db from "@/db";
import { userGroupMembers, userGroups } from "@/db/schema";
import { auth } from "@/lib/auth";

export type CreateUserGroupData = {
  name: string;
  description?: string;
  memberIds?: string[]; // User IDs to add as members
};

export type UpdateUserGroupData = {
  id: string;
  name?: string;
  description?: string;
};

export async function createUserGroup(data: CreateUserGroupData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  // Check if user is admin or instructor
  if (session.user.role !== "admin" && session.user.role !== "instructor") {
    return {
      error: "Forbidden: Only admins and instructors can create groups",
    };
  }

  try {
    const [group] = await db
      .insert(userGroups)
      .values({
        name: data.name,
        description: data.description,
      })
      .returning();

    // Add members if provided
    if (data.memberIds && data.memberIds.length > 0) {
      const memberRecords = data.memberIds.map((userId) => ({
        groupId: group.id,
        userId: userId,
      }));

      await db.insert(userGroupMembers).values(memberRecords);
    }

    return { success: true, groupId: group.id };
  } catch (error) {
    console.error("Error creating user group:", error);
    return { error: "Failed to create user group" };
  }
}

export async function updateUserGroup(data: UpdateUserGroupData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  if (session.user.role !== "admin" && session.user.role !== "instructor") {
    return {
      error: "Forbidden: Only admins and instructors can update groups",
    };
  }

  try {
    const updateData: Partial<typeof userGroups.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;

    await db
      .update(userGroups)
      .set(updateData)
      .where(eq(userGroups.id, data.id));

    return { success: true };
  } catch (error) {
    console.error("Error updating user group:", error);
    return { error: "Failed to update user group" };
  }
}

export async function deleteUserGroup(groupId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  if (session.user.role !== "admin" && session.user.role !== "instructor") {
    return {
      error: "Forbidden: Only admins and instructors can delete groups",
    };
  }

  try {
    await db.delete(userGroups).where(eq(userGroups.id, groupId));
    return { success: true };
  } catch (error) {
    console.error("Error deleting user group:", error);
    return { error: "Failed to delete user group" };
  }
}

export async function addUserToGroup(groupId: string, userId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  if (session.user.role !== "admin" && session.user.role !== "instructor") {
    return {
      error: "Forbidden: Only admins and instructors can add users to groups",
    };
  }

  try {
    await db.insert(userGroupMembers).values({
      groupId,
      userId,
    });

    return { success: true };
  } catch (error) {
    console.error("Error adding user to group:", error);
    return { error: "Failed to add user to group" };
  }
}

export async function removeUserFromGroup(groupId: string, userId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  if (session.user.role !== "admin" && session.user.role !== "instructor") {
    return {
      error:
        "Forbidden: Only admins and instructors can remove users from groups",
    };
  }

  try {
    await db
      .delete(userGroupMembers)
      .where(
        and(
          eq(userGroupMembers.groupId, groupId),
          eq(userGroupMembers.userId, userId),
        ),
      );

    return { success: true };
  } catch (error) {
    console.error("Error removing user from group:", error);
    return { error: "Failed to remove user from group" };
  }
}

export async function getUserGroups() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized", groups: [] };
  }

  try {
    const groups = await db.query.userGroups.findMany({
      orderBy: (userGroups, { desc }) => [desc(userGroups.createdAt)],
      with: {
        members: true,
      },
    });

    return { groups };
  } catch (error) {
    console.error("Error fetching user groups:", error);
    return { error: "Failed to fetch user groups", groups: [] };
  }
}

export async function getGroupMembers(groupId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized", members: [] };
  }

  try {
    const members = await db.query.userGroupMembers.findMany({
      where: (members, { eq }) => eq(members.groupId, groupId),
      with: {
        user: true,
      },
    });

    return { members };
  } catch (error) {
    console.error("Error fetching group members:", error);
    return { error: "Failed to fetch group members", members: [] };
  }
}
