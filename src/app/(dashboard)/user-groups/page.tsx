import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserGroups } from "@/actions/user-groups";
import UserGroupsClient from "@/components/layouts/user-groups/user-groups-client";
import db from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function UserGroupsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  // Only allow admins and instructors
  if (session.user.role !== "admin" && session.user.role !== "instructor") {
    redirect("/dashboard");
  }

  const groupsResult = await getUserGroups();
  const groups = groupsResult.groups || [];

  // Fetch all users for adding to groups
  const users = await db.select().from(user);

  return <UserGroupsClient groups={groups} users={users} />;
}
