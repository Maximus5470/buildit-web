import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UserManagementClient from "@/components/layouts/user-management/user-management-client";
import db from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function UsersPage() {
  // Check if user is admin
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch all users
  const users = await db.select().from(user).orderBy(user.createdAt);

  // Map database users to the expected UI format
  // For now, use placeholder values for fields not in the database
  // These will be added to the schema later when backend is implemented
  return (
    <UserManagementClient
      users={users.map((u) => ({
        id: u.id,
        rollNo: u.rollNumber || "",
        name: u.name,
        email: u.email,
        gender: (u.gender as "male" | "female" | "other") || "male",
        branch: u.branch || "",
        semester: u.semester || "",
        section: u.section || "",
        regulation: u.regulation || "",
        role: u.role as "student" | "instructor" | "admin",
        createdAt: u.createdAt,
        banned: u.banned,
      }))}
    />
  );
}
