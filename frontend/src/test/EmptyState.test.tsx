import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/EmptyState";

describe("EmptyState", () => {
  it("explains why a table is empty", () => {
    render(
      <EmptyState
        title="No test runs yet."
        description="Start your first AI test to analyze this application."
      />,
    );
    expect(screen.getByText("No test runs yet.")).toBeInTheDocument();
    expect(screen.getByText("Start your first AI test to analyze this application.")).toBeInTheDocument();
  });
});
