"use client";

import { CheckCircle2, Circle, Code2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { Problem } from "@/types/problem";

interface ExamSidebarProps {
  examTitle: string;
  questions: Pick<Problem, "id" | "title">[];
  activeId: string | null;
  onSelect: (id: string) => void;
  completedQuestionIds: string[];
}

export function ExamSidebar({
  examTitle,
  questions,
  activeId,
  onSelect,
  completedQuestionIds,
}: ExamSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Code2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{examTitle}</span>
                <span className="truncate text-xs">Powered by BuildIT</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Questions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {questions.map((q, idx) => {
                const isActive = activeId === q.id;
                const isCompleted = completedQuestionIds.includes(q.id);

                return (
                  <SidebarMenuItem key={q.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSelect(q.id)}
                      tooltip={q.title}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="text-green-500" />
                      ) : (
                        <Circle className="text-muted-foreground" />
                      )}
                      <span>
                        {idx + 1}. {q.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
