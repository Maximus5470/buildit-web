import { redirect } from "next/navigation";

// This page is deprecated - redirect to the new results page
export default async function ExamSubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{
    examId?: string;
    assignmentId?: string;
  }>;
}) {
  const params = await searchParams;

  // Redirect to new results page
  if (params.examId) {
    redirect(`/${params.examId}/results`);
  }

  // Default fallback to dashboard
  redirect("/dashboard");
}
