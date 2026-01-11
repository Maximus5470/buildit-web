import { headers } from "next/headers";
import { getExams } from "@/actions/exams-list";
import { auth } from "@/lib/auth";
import { searchParamsCache } from "@/lib/search-params/exams";
import { ExamsView } from "../../../components/layouts/exams/exams-view";

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const {
    page,
    q: search,
    status,
    sort,
    error,
  } = await searchParamsCache.parse(searchParams);

  // Get current user
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user?.id;
  const userRole = session?.user?.role;

  // TODO: Fetch termination details from examAssignments if needed
  const terminationDetails = undefined;

  const { data, total } = await getExams({
    page,
    search: search || undefined, // nuqs returns "" by default, getExams expects string | undefined
    status: status || undefined,
    sort: sort || undefined, // getExams handles default sort logic, but we can pass it explicitly
    perPage: 10,
    // Only filter by userId for students; admins and instructors see all exams
    userId:
      userRole === "admin" || userRole === "instructor" ? undefined : userId,
  });

  return (
    <ExamsView
      data={data}
      total={total}
      error={error}
      terminationDetails={terminationDetails}
    />
  );
}
