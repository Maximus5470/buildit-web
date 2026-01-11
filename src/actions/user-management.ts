"use server";

import { eq } from "drizzle-orm";
import db from "@/db";
import { session, user } from "@/db/schema";

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

export async function updateUser(data: UpdateUserData) {
    try {
        const existingUser = await db.query.user.findFirst({
            where: eq(user.id, data.id),
        });

        if (!existingUser) {
            return { success: false, error: "User not found" };
        }

        const updateData: Partial<typeof user.$inferInsert> = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.role !== undefined) updateData.role = data.role;
        if (data.banned !== undefined) updateData.banned = data.banned;
        if (data.banReason !== undefined) updateData.banReason = data.banReason;

        // If unbanning, clear the ban reason
        if (data.banned === false) {
            updateData.banReason = null;
            updateData.banExpires = null;
        }

        await db.update(user).set(updateData).where(eq(user.id, data.id));

        // If user is being banned, revoke all their active sessions to force logout
        if (data.banned === true) {
            await db.delete(session).where(eq(session.userId, data.id));
            console.log(`[User Management] Revoked all sessions for banned user: ${data.id}`);
        }

        const updatedUser = await db.query.user.findFirst({
            where: eq(user.id, data.id),
        });

        return { success: true, user: updatedUser };
    } catch (error) {
        console.error("Error updating user:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update user",
        };
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
        const result = await db.delete(session).where(eq(session.userId, userId));
        console.log(`[User Management] Revoked all sessions for user: ${userId}`);
        return { success: true, message: "All sessions revoked" };
    } catch (error) {
        console.error("Error revoking sessions:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to revoke sessions",
        };
    }
}
