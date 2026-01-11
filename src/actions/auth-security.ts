"use server";

import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import db from "@/db";
import { session as sessionTable } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function enforceSingleSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { error: "Unauthorized" };
    }

    // Delete all sessions for this user EXCEPT the current one
    await db
      .delete(sessionTable)
      .where(
        and(
          eq(sessionTable.userId, session.user.id),
          ne(sessionTable.id, session.session.id),
        ),
      );

    return { success: true };
  } catch (error) {
    console.error("Error enforcing single session:", error);
    return { error: "Failed to enforce single session" };
  }
}
