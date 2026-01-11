import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getQuestionCollections } from "@/actions/question-collections-list";
import CreateExamClient from "@/components/layouts/create-exam/create-exam-client";
import db from "@/db";
import { collectionQuestions, questions, user, userGroups } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function CreateExamPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (
    !session ||
    (session.user.role !== "admin" && session.user.role !== "instructor")
  ) {
    redirect("/dashboard");
  }

  // Fetch question collections, questions, users, and groups for the exam creation form
  const [
    questionCollectionsResult,
    questionsResult,
    usersResult,
    groupsResult,
  ] = await Promise.all([
    getQuestionCollections({ perPage: 100 }),
    db
      .select({
        id: questions.id,
        title: questions.title,
        problemStatement: questions.problemStatement,
        difficulty: questions.difficulty,
        allowedLanguages: questions.allowedLanguages,
        collectionId: collectionQuestions.collectionId,
      })
      .from(questions)
      .leftJoin(
        collectionQuestions,
        eq(questions.id, collectionQuestions.questionId),
      ),
    db.select().from(user).orderBy(user.createdAt),
    db.select().from(userGroups).orderBy(userGroups.name),
  ]);

  // Map users to expected format (simplifying for now as per user-management)
  const users = usersResult.map((u) => ({
    id: u.id,
    rollNo: u.username || u.id.slice(0, 10).toUpperCase(),
    name: u.name,
    email: u.email,
    // Add other fields as optional or placeholders if needed by the client type
    role: u.role as "student" | "instructor" | "admin",
    branch: "CSE", // Placeholder
    semester: "5", // Placeholder
  }));

  // Map questions to problems format
  const allProblems = questionsResult.map((q) => ({
    id: q.id,
    title: q.title,
    description: q.problemStatement || "",
    difficulty: q.difficulty,
    collectionId: q.collectionId,
  }));

  // Map question collections
  const allCollections = questionCollectionsResult.data.map((c) => ({
    id: c.id,
    name: c.title,
    description: c.description,
  }));

  return (
    <CreateExamClient
      collections={allCollections}
      problems={allProblems}
      groups={groupsResult}
      users={users}
    />
  );
}
