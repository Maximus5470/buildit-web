import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getQuestionsInCollection } from "@/actions/question-collections-list";
import { CollectionDetailsView } from "@/components/layouts/collections/collection-details-view";
import db from "@/db";
import { questionCollections } from "@/db/schema";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CollectionDetailsPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const urlParams = await searchParams;
  const page = Number(urlParams.page) || 1;

  const collection = await db.query.questionCollections.findFirst({
    where: eq(questionCollections.id, id),
  });

  if (!collection) {
    notFound();
  }

  const { data: questions, total } = await getQuestionsInCollection(
    id,
    page,
    10,
  );

  return (
    <CollectionDetailsView
      collection={{ ...collection, tags: collection.tags || [] }}
      questions={questions}
      total={total}
      currentPage={page}
    />
  );
}
