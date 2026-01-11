import { getQuestionCollections } from "@/actions/question-collections-list";
import { CollectionsView } from "@/components/layouts/collections/collections-view";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = typeof params.q === "string" ? params.q : undefined;
  const sort = typeof params.sort === "string" ? params.sort : undefined;
  const type = typeof params.type === "string" ? params.type : undefined;

  const { data, total } = await getQuestionCollections({
    page,
    search,
    sort,
    perPage: 10,
  });

  return (
    <CollectionsView
      data={data.map((c) => ({ ...c, tags: c.tags || [] }))}
      total={total}
      type={type}
    />
  );
}
