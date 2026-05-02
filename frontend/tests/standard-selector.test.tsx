import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StandardSelector } from "@/components/StandardSelector";
import type { SiteStandard } from "@/lib/api";

describe("StandardSelector", () => {
  const mockStandards: SiteStandard[] = [
    { source_id: "ss554", title: "SS 554", is_active: true },
    { source_id: "well-v2", title: "WELL v2", is_active: true },
    { source_id: "safespace", title: "SafeSpace", is_active: false },
  ];

  it("renders list of active standards", () => {
    const handleChange = vi.fn();
    render(
      <StandardSelector
        standards={mockStandards}
        activeStandardId="ss554"
        onStandardChange={handleChange}
      />
    );
    expect(screen.getByText("SS 554")).toBeTruthy();
    expect(screen.getByText("WELL v2")).toBeTruthy();
  });

  it("does not render inactive standards", () => {
    const handleChange = vi.fn();
    render(
      <StandardSelector
        standards={mockStandards}
        activeStandardId="ss554"
        onStandardChange={handleChange}
      />
    );
    expect(screen.queryByText("SafeSpace")).toBeNull();
  });

  it("calls onStandardChange when clicking a different standard", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StandardSelector
        standards={mockStandards}
        activeStandardId="ss554"
        onStandardChange={handleChange}
      />
    );
    await user.click(screen.getByText("WELL v2"));
    expect(handleChange).toHaveBeenCalledWith("well-v2");
  });

  it("shows message when no active standards", () => {
    const handleChange = vi.fn();
    render(
      <StandardSelector
        standards={[]}
        activeStandardId=""
        onStandardChange={handleChange}
      />
    );
    expect(
      screen.getByText("No standards configured for this site.")
    ).toBeTruthy();
  });
});
