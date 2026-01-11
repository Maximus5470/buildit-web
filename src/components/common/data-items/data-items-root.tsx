"use client";

import { LayoutGrid, List, Plus, RotateCcw, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DataItemsViewProps, ViewMode } from "./types";

// If useDebounce hook doesn't exist, we can implement a simple effect inside,
// but for now I'll assume standard debounce usage or implement inline.

export function DataItemsView<T extends { id: string }>({
  title,
  description,
  data,
  totalItems,
  renderCard,
  columns,
  availableViews = ["table", "card"],
  defaultView = "table",
  searchPlaceholder = "Search...",
  filters = [],
  sortOptions = [],
  createAction,
  extraHeader,
  headerAction,
}: DataItemsViewProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [view, setView] = useQueryState(
    "view",
    parseAsString.withDefault(defaultView).withOptions({ shallow: false }),
  );
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: false, throttleMs: 1000 }), // Added throttle to prevent rapid server hits? No, debounce handles input. But here we set URL.
  );
  // Actually, localSearch handles debounce. setSearch is called after debounce.
  // So shallow: false is correct here.

  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsString.withOptions({ shallow: false }),
  );

  // Filter states - dynamically generated?
  // For simplicity, we can't dynamic hook call easily with nuqs for dynamic keys in this generic.
  // BUT the parent can pass specific filter/sort params if needed, or we handle them generically here.
  // Ideally, the Parent passes the data which IS ALREADY filtered.
  // This component simply triggers the URL updates.

  // Local state for search input to avoid lag
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch || null);
        setPage(1); // Reset to page 1 on search
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, search, setSearch, setPage]);

  // Reset function
  const resetAll = () => {
    // 1. Clear known states via setters
    // We use setters that might trigger navigation?
    // If we simply push URL, it's cleaner.

    // ... (rest of resetAll logic remains, router.push is inherently deep if not specified otherwise in typical nextjs usage, but wait)
    // router.push triggers server component refresh in App Router.
    // So resetAll is already fine.

    // 2. Clear dynamic filters using URL manipulation
    // We construct a new URLSearchParams with ONLY the 'view' param (if it exists)
    // and any other params that might be there NOT related to our managed state?
    // Actually, simpler: take current params, delete known keys.
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("q");
    newParams.delete("page");
    newParams.delete("sort");

    // Delete all dynamic filter keys
    for (const filter of filters) {
      newParams.delete(filter.key);
    }

    // Push new URL. nuqs should pick this up.
    // Note: setSearch/setPage/setSort might be redundant if we just push URL,
    // but they update internal state immediately which is good for UX.
    // However, they might race with router.push.
    // Let's try just router.push first, nuqs syncs.
    // Actually, nuqs hooks (search, page, sort) will update when URL changes.
    // So router.push is the source of truth modification here.

    router.push(`${pathname}?${newParams.toString()}`);
  };

  // View Mode handling
  const currentView = (
    availableViews.includes(view as ViewMode) ? view : availableViews[0]
  ) as ViewMode;

  const ITEMS_PER_PAGE = 10; // Could be configurable
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4 p-6 h-[calc(100vh-4rem)] w-full max-w-7xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {createAction && (
          <Button onClick={createAction.onClick} className="shrink-0 gap-2">
            {createAction.icon || <Plus className="h-4 w-4" />}
            {createAction.label}
          </Button>
        )}
        {headerAction}
      </div>

      {/* Header & Controls Card */}
      {(extraHeader ||
        filters.length > 0 ||
        sortOptions.length > 0 ||
        availableViews.length > 1 ||
        localSearch !== undefined) && (
        <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border shadow-sm flex-none">
          {extraHeader}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Search - Column 1 */}
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-9 w-full h-10"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
            </div>

            {/* Filters - Column 2 */}
            <div className="flex items-center gap-2 w-full">
              {filters.map((filter) => (
                <div key={filter.key} className="flex-1">
                  <FilterControl filter={filter} />
                </div>
              ))}
            </div>

            {/* Sort & Actions - Column 3 */}
            <div className="flex items-center gap-2 justify-end">
              {/* Sort */}
              {sortOptions.length > 0 && (
                <Select
                  value={sort || ""}
                  onValueChange={(val: string) => setSort(val || null)}
                >
                  <SelectTrigger className="w-[160px] h-10">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* View Toggle */}
              {availableViews.length > 1 && (
                <div className="flex items-center border rounded-md bg-background h-10">
                  <Button
                    variant={currentView === "table" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-none first:rounded-l-md"
                    onClick={() => setView("table")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={currentView === "card" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-none last:rounded-l-none last:rounded-r-md"
                    onClick={() => setView("card")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Reset Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetAll}
                    className="h-10 w-10"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset filters</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "flex-1 min-h-0 border rounded-md bg-background flex flex-col",
          currentView === "card" && "overflow-auto",
        )}
      >
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground h-full">
            <p>No items found</p>
          </div>
        ) : currentView === "table" && columns ? (
          <Table
            className="border-separate border-spacing-0"
            containerClassName="flex-1 overflow-auto"
          >
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm [&_th]:bg-background">
              <TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                {columns.map((col) => (
                  <TableHead
                    key={col.accessorKey.toString()}
                    className={col.className}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {(page - 1) * ITEMS_PER_PAGE + idx + 1}
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col.accessorKey.toString()}
                      className={col.className}
                    >
                      {typeof col.accessorKey === "function"
                        ? col.accessorKey(item)
                        : (item[col.accessorKey] as ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((item) => (
              <div key={item.id} className="h-full">
                {renderCard ? (
                  renderCard(item)
                ) : (
                  <div className="p-4 border rounded">
                    {JSON.stringify(item)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-none py-2 border-t bg-background">
          <PaginationSection
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

// Sub-components

function FilterControl({
  filter,
}: {
  filter: {
    label: string;
    key: string;
    options: { label: string; value: string }[];
  };
}) {
  const [value, setValue] = useQueryState(
    filter.key,
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );

  return (
    <Select
      value={value}
      onValueChange={(val: string) => setValue(val === "all" ? null : val)}
    >
      <SelectTrigger className="w-full h-10">
        <SelectValue placeholder={filter.label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {filter.label}</SelectItem>
        {filter.options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PaginationSection({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const showMax = 5;

    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + showMax - 1);

    if (end - start < showMax - 1) {
      start = Math.max(1, end - showMax + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("ellipsis-start");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("ellipsis-end");
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (page > 1) onPageChange(page - 1);
            }}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {getPageNumbers().map((p) => (
          <PaginationItem key={p.toString()}>
            {p === "ellipsis-start" || p === "ellipsis-end" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                isActive={page === p}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(p as number);
                }}
              >
                {p}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (page < totalPages) onPageChange(page + 1);
            }}
            className={
              page >= totalPages ? "pointer-events-none opacity-50" : ""
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
