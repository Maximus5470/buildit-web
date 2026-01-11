"use server";

import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import db from "@/db";
import {
  collectionQuestions,
  questionCollections,
  questions,
} from "@/db/schema";

export type GetQuestionCollectionsParams = {
  page?: number;
  perPage?: number;
  search?: string;
  sort?: string;
};

export async function getQuestionCollections({
  page = 1,
  perPage = 10,
  search,
  sort,
}: GetQuestionCollectionsParams = {}) {
  const conditions = [];

  if (search) {
    conditions.push(ilike(questionCollections.title, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let orderBy = desc(questionCollections.createdAt);
  if (sort === "title-asc") orderBy = asc(questionCollections.title);
  if (sort === "title-desc") orderBy = desc(questionCollections.title);
  if (sort === "created-asc") orderBy = asc(questionCollections.createdAt);
  if (sort === "created-desc") orderBy = desc(questionCollections.createdAt);

  const data = await db
    .select()
    .from(questionCollections)
    .where(whereClause)
    .limit(perPage)
    .offset((page - 1) * perPage)
    .orderBy(orderBy);

  const [countResult] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(questionCollections)
    .where(whereClause);

  const total = countResult?.count ?? 0;

  return { data, total };
}

export async function getQuestionsInCollection(
  collectionId: string,
  page: number = 1,
  perPage: number = 10,
) {
  const questionsInCollection = await db
    .select({
      id: questions.id,
      title: questions.title,
      problemStatement: questions.problemStatement,
      difficulty: questions.difficulty,
      allowedLanguages: questions.allowedLanguages,
      addedAt: collectionQuestions.addedAt,
    })
    .from(collectionQuestions)
    .innerJoin(questions, eq(collectionQuestions.questionId, questions.id))
    .where(eq(collectionQuestions.collectionId, collectionId))
    .limit(perPage)
    .offset((page - 1) * perPage)
    .orderBy(asc(collectionQuestions.addedAt));

  const [countResult] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(collectionQuestions)
    .where(eq(collectionQuestions.collectionId, collectionId));

  const total = countResult?.count ?? 0;

  return {
    data: questionsInCollection.map((q) => ({
      ...q,
      allowedLanguages: Array.isArray(q.allowedLanguages)
        ? q.allowedLanguages
        : [],
    })),
    total,
  };
}

export async function getAllQuestions(search?: string) {
  const conditions = [];

  if (search) {
    conditions.push(ilike(questions.title, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const allQuestions = await db
    .select({
      id: questions.id,
      title: questions.title,
      problemStatement: questions.problemStatement,
      difficulty: questions.difficulty,
      allowedLanguages: questions.allowedLanguages,
    })
    .from(questions)
    .where(whereClause)
    .orderBy(asc(questions.title))
    .limit(100);

  return allQuestions;
}

export async function addQuestionToCollection(
  collectionId: string,
  questionId: string,
) {
  try {
    // Check if the question is already in the collection
    const existing = await db
      .select()
      .from(collectionQuestions)
      .where(
        and(
          eq(collectionQuestions.collectionId, collectionId),
          eq(collectionQuestions.questionId, questionId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: "Question is already in this collection",
      };
    }

    await db.insert(collectionQuestions).values({
      collectionId,
      questionId,
    });

    return { success: true };
  } catch (error) {
    console.error("Error adding question to collection:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to add question to collection",
    };
  }
}

export async function removeQuestionFromCollection(
  collectionId: string,
  questionId: string,
) {
  try {
    await db
      .delete(collectionQuestions)
      .where(
        and(
          eq(collectionQuestions.collectionId, collectionId),
          eq(collectionQuestions.questionId, questionId),
        ),
      );
    return { success: true };
  } catch (error) {
    console.error("Error removing question from collection:", error);
    return {
      success: false,
      error: "Failed to remove question from collection",
    };
  }
}
