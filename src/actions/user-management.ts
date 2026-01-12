"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { User } from "@/components/layouts/user-management/user-management-client";
import db from "@/db";
import { session, user } from "@/db/schema";
import { auth } from "@/lib/auth";

export interface UpdateUserData {
  id: string;
  name?: string;
  gender?: "male" | "female" | "other";
  branch?: string;
  semester?: string;
  section?: string;
  regulation?: string;
  role?: "student" | "instructor" | "admin";
  banned?: boolean;
  banReason?: string | null;
}

export type CreateUserData = {
  rollNo?: string;
  name: string;
  email: string;
  gender: "male" | "female" | "other";
  dateOfBirth?: Date;
  branch: string;
  semester: string;
  section: string;
  regulation: string;
  role: "student" | "instructor" | "admin";
};

/**
 * Create a new user account and associated profile data
 */
export async function createUser(data: CreateUserData) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    return { error: "Unauthorized" };
  }

  // Only admins and instructors can create users
  if (
    currentSession.user.role !== "admin" &&
    currentSession.user.role !== "instructor"
  ) {
    return { error: "Forbidden" };
  }

  try {
    // 1. Create user via Better Auth (handles password hashing)
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: "password1234", // Default password
        name: data.name,
      },
    });

    if (!signUpResult?.user) {
      return { error: "Failed to create user account" };
    }

    // 2. Update the user with our specific fields
    await db
      .update(user)
      .set({
        rollNumber: data.rollNo,
        role: data.role,
        branch: data.branch,
        semester: data.semester,
        section: data.section,
        regulation: data.regulation,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
      })
      .where(eq(user.id, signUpResult.user.id));

    // Refetch the user to return fully formed object
    const newUser = await db.query.user.findFirst({
      where: eq(user.id, signUpResult.user.id),
    });

    if (!newUser) {
      return { error: "Failed to retrieve created user" };
    }

    // Map to the Client User interface
    const clientUser: User = {
      id: newUser.id,
      rollNo: newUser.rollNumber || "",
      name: newUser.name,
      email: newUser.email,
      gender: (newUser.gender as "male" | "female" | "other") || "male",
      branch: newUser.branch || "",
      semester: newUser.semester || "",
      section: newUser.section || "",
      regulation: newUser.regulation || "",
      role: newUser.role as "student" | "instructor" | "admin",
      createdAt: newUser.createdAt,
      banned: newUser.banned,
      dateOfBirth: newUser.dateOfBirth
        ? new Date(newUser.dateOfBirth)
        : undefined,
    };

    return { success: true, user: clientUser };
  } catch (error) {
    console.error("Error creating user:", error);
    return { error: "Failed to create user. Email might already exist." };
  }
}

/**
 * Update an existing user's profile or status
 */
export async function updateUser(data: UpdateUserData) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    return { error: "Unauthorized" };
  }

  if (
    currentSession.user.role !== "admin" &&
    currentSession.user.role !== "instructor"
  ) {
    return { error: "Forbidden" };
  }

  try {
    const existingUser = await db.query.user.findFirst({
      where: eq(user.id, data.id),
    });

    if (!existingUser) {
      return { error: "User not found" };
    }

    const updateData: Partial<typeof user.$inferInsert> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.banned !== undefined) updateData.banned = data.banned;
    if (data.banReason !== undefined) updateData.banReason = data.banReason;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.branch !== undefined) updateData.branch = data.branch;
    if (data.semester !== undefined) updateData.semester = data.semester;
    if (data.section !== undefined) updateData.section = data.section;
    if (data.regulation !== undefined) updateData.regulation = data.regulation;

    // If unbanning, clear the ban reason
    if (data.banned === false) {
      updateData.banReason = null;
      updateData.banExpires = null;
    }

    await db.update(user).set(updateData).where(eq(user.id, data.id));

    // If user is being banned, revoke all their active sessions to force logout
    if (data.banned === true) {
      await db.delete(session).where(eq(session.userId, data.id));
      console.log(
        `[User Management] Revoked all sessions for banned user: ${data.id}`,
      );
    }

    const updatedUser = await db.query.user.findFirst({
      where: eq(user.id, data.id),
    });

    return { success: true, user: updatedUser };
  } catch (error) {
    console.error("Error updating user:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update user",
    };
  }
}

/**
 * Delete a user and all associated data (cascades)
 */
export async function deleteUser(userId: string) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    return { error: "Unauthorized" };
  }

  if (
    currentSession.user.role !== "admin" &&
    currentSession.user.role !== "instructor"
  ) {
    return { error: "Forbidden" };
  }

  try {
    await db.delete(user).where(eq(user.id, userId));
    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { error: "Failed to delete user" };
  }
}

export async function banUser(userId: string, reason?: string) {
  return updateUser({
    id: userId,
    banned: true,
    banReason: reason || "Banned by administrator",
  });
}

export async function unbanUser(userId: string) {
  return updateUser({
    id: userId,
    banned: false,
    banReason: null,
  });
}

/**
 * Revoke all sessions for a specific user
 * Useful for forcing logout without banning
 */
export async function revokeUserSessions(userId: string) {
  try {
    await db.delete(session).where(eq(session.userId, userId));
    console.log(`[User Management] Revoked all sessions for user: ${userId}`);
    return { success: true, message: "All sessions revoked" };
  } catch (error) {
    console.error("Error revoking sessions:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to revoke sessions",
    };
  }
}
