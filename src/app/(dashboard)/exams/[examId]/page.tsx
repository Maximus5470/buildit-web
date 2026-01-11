import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getExam } from "@/actions/exam-details";
import { ExamDetailsView } from "@/components/layouts/exams/exam-details-view";
import { auth } from "@/lib/auth";

export default async function ExamDetailsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const exam = await getExam(examId, session?.user?.id);

  if (!exam) {
    notFound();
  }

  return <ExamDetailsView exam={exam} />;
}
