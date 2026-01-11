"use client";

import { format } from "date-fns";
import { BookOpen, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataItemsView } from "@/components/common/data-items/data-items-root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageName } from "@/hooks/use-page-name";
import { useSession } from "@/lib/auth-client";

interface QuestionCollection {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface CollectionsViewProps {
  data: QuestionCollection[];
  total: number;
  type?: string;
}

export function CollectionsView({ data, total, type }: CollectionsViewProps) {
  usePageName("Collections");
  const session = useSession();
  const router = useRouter();

  const columns = [
    {
      header: "Title",
      accessorKey: "title" as keyof QuestionCollection,
      className: "font-medium",
    },
    {
      header: "Description",
      accessorKey: (item: QuestionCollection) => (
        <span className="text-muted-foreground line-clamp-2">
          {item.description || "No description"}
        </span>
      ),
    },
    {
      header: "Tags",
      accessorKey: (item: QuestionCollection) => (
        <div className="flex gap-1 flex-wrap">
          {item.tags && item.tags.length > 0 ? (
            item.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">No tags</span>
          )}
        </div>
      ),
    },
    {
      header: "Created",
      accessorKey: (item: QuestionCollection) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{format(item.createdAt, "MMM d, yyyy")}</span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: (item: QuestionCollection) => (
        <Button asChild size="sm" variant="outline">
          <Link href={`/collections/${item.id}`}>View</Link>
        </Button>
      ),
      className: "w-[100px]",
    },
  ];

  const renderCard = (item: QuestionCollection) => (
    // biome-ignore lint/a11y/useSemanticElements: Complex card layout
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/collections/${item.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/collections/${item.id}`);
        }
      }}
      className="flex flex-col h-full border rounded-xl p-6 hover:border-primary/50 transition-colors bg-card text-card-foreground shadow-sm cursor-pointer"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
      </div>

      <h3 className="text-xl font-bold mb-2 line-clamp-1">{item.title}</h3>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
        {item.description || "No description provided"}
      </p>

      <div className="flex gap-1 flex-wrap mb-4">
        {item.tags && item.tags.length > 0 ? (
          item.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground text-xs">No tags</span>
        )}
      </div>

      <div className="mt-auto pt-4 border-t flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>Created {format(item.createdAt, "MMM d, yyyy")}</span>
      </div>
    </div>
  );

  return (
    <DataItemsView
      title="Collections"
      description="Browse and manage question collections."
      data={data}
      totalItems={total}
      columns={columns}
      renderCard={renderCard}
      defaultView="card"
      availableViews={["card", "table"]}
      filters={
        type
          ? [
              {
                label: "Type",
                key: "type",
                options: [
                  { label: "All Collections", value: "" },
                  { label: "Your Collections", value: "private" },
                  { label: "Practice", value: "practice" },
                  { label: "Company", value: "company" },
                ],
              },
            ]
          : []
      }
      sortOptions={[
        { label: "Recently Created", value: "created-desc" },
        { label: "Oldest First", value: "created-asc" },
        { label: "Title (A-Z)", value: "title-asc" },
        { label: "Title (Z-A)", value: "title-desc" },
      ]}
      createAction={
        session?.data?.user.role === "instructor" ||
        session?.data?.user.role === "admin"
          ? {
              label: "Create Collection",
              onClick: () => {
                router.push("/collections/create");
              },
            }
          : undefined
      }
    />
  );
}
