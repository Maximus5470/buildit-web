import type { ExamConfig } from "./exam-config";

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  config: ExamConfig | null;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date;
  status: "upcoming" | "ongoing" | "completed";
  pin?: string | null;
  userSessionStatus?: string | null;
  examGroups?: Array<{
    id: string;
    pin: string | null;
    groupId: string;
    startTime: Date | null;
    endTime: Date | null;
    group: {
      id: string;
      name: string;
    };
  }>;
}

export type CreateExamData = {
  title: string;
  startTime?: Date;
  endTime?: Date;
  durationMinutes: number;
  config: ExamConfig;
  groupIds?: string[];
  groupSchedules?: {
    groupId: string;
    startTime: Date;
    endTime: Date;
  }[];
};

export type GetExamsParams = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: "upcoming" | "ongoing" | "completed";
  sort?: string;
  userId?: string;
};
