"use server";

import { and, eq, inArray } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import db from "@/db";
import { examGroups, userGroupMembers } from "@/db/schema";
import { addDays } from "date-fns";
import { auth } from "@/lib/auth";

export async function verifyExamPin(examId: string, pin: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { error: "Unauthorized" };
        }

        // Get user's groups
        const userMemberships = await db.query.userGroupMembers.findMany({
            where: eq(userGroupMembers.userId, session.user.id),
        });
        const userGroupIds = userMemberships.map((m) => m.groupId);

        if (userGroupIds.length === 0) {
            return { error: "You are not part of any group." };
        }

        // Find relevant exam groups for this exam and user's groups
        const relevantSlots = await db.query.examGroups.findMany({
            where: and(
                eq(examGroups.examId, examId),
                inArray(examGroups.groupId, userGroupIds),
            ),
        });

        if (relevantSlots.length === 0) {
            return { error: "Access Denied: This exam is not assigned to your group." };
        }

        // Check if ANY of the user's assigned slots matches the PIN
        // If multiple groups are assigned to the same exam, any valid PIN should work.
        const validMatch = relevantSlots.find(slot => slot.pin === pin);

        if (!validMatch) {
            return { error: "Invalid PIN for your batch." };
        }

        // Set a cookie to authorize access to this exam
        const cookieStore = await cookies();
        cookieStore.set(`exam_access_${examId}`, "true", {
            expires: addDays(new Date(), 1), // Valid for 1 day
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        });

        return { success: true };
    } catch (error) {
        console.error("Error verifying PIN:", error);
        return { error: "Failed to verify PIN" };
    }
}
