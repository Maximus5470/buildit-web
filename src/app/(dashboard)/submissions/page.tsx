import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getExamAssignmentsList } from "@/actions/exam-assignments-list";
import { SubmissionsView } from "@/components/layouts/submissions/submissions-view";
import { auth } from "@/lib/auth";

export default async function SubmissionsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  // Check if user is admin or instructor
  if (session.user.role !== "admin" && session.user.role !== "instructor") {
    redirect("/dashboard");
  }

  const result = await getExamAssignmentsList();

  if (!result.success) {
    return <div>Error loading submissions</div>;
  }

  return <SubmissionsView data={result.data} total={result.total} />;
}
