import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{
    examId: string;
  }>;
}

export default async function ExamRootPage({ params }: PageProps) {
  const { examId } = await params;

  // Redirect to onboarding page
  redirect(`/${examId}/onboarding`);
}
