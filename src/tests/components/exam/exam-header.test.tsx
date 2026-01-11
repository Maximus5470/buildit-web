import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExamHeader } from "@/components/layouts/exam/exam-header";

describe("ExamHeader", () => {
  const defaultProps = {
    user: {
      name: "Test User",
    },
    examTitle: "Test Exam",
    assignmentId: "test-assignment-id",
    endTime: new Date(Date.now() + 3600000), // 1 hour from now
  };

  it("should render title", () => {
    render(<ExamHeader {...defaultProps} />);
    expect(screen.getByText("Test Exam")).toBeInTheDocument();
  });

  it("should render user name", () => {
    render(<ExamHeader {...defaultProps} />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });
});
