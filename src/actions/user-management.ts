"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { User } from "@/components/layouts/user-management/user-management-client";
import db from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";

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

export async function createUser(data: CreateUserData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  // Only admins and instructors can create users
  if (session.user.role !== "admin" && session.user.role !== "instructor") {
    return { error: "Forbidden" };
  }

  try {
    // 1. Create user via Better Auth (handles password hashing)
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: "password1234", // Default password
        name: data.name,
        // We can pass other fields if better-auth is configured to accept them,
        // but to be safe we will update them directly in DB after creation if needed.
        // However, better-auth with drizzle adapter usually writes all matching fields.
        // We will try passing them.
      },
    });

    if (!signUpResult?.user) {
      // Fallback or error
      return { error: "Failed to create user account" };
    }

    // 2. Update the user with our specific fields
    // (In case better-auth didn't pick up the extra fields)
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
    const [newUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, signUpResult.user.id));

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
    // Be more specific if possible. Email duplicate?
    return { error: "Failed to create user. Email might already exist." };
  }
}

export async function deleteUser(userId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  // Only admins can delete users, or instructors if allowed (assuming admins for now)
  if (session.user.role !== "admin" && session.user.role !== "instructor") {
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
