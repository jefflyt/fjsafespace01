import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteOverviewCard } from "@/components/SiteOverviewCard";

describe("SiteOverviewCard", () => {
  const defaultProps = {
    siteName: "Test Site",
    lastUpdated: "2026-04-30T10:00:00Z",
    scanMode: "adhoc" as const,
    standardScores: [
      { sourceId: "ss554", title: "SS 554", score: 85, outcome: "PASS" },
      { sourceId: "well-v2", title: "WELL v2", score: 70, outcome: "FAIL" },
    ],
    overallWellness: 78,
  };

  it("renders site name", () => {
    render(<SiteOverviewCard {...defaultProps} />);
    expect(screen.getByText("Test Site")).toBeTruthy();
  });

  it("renders last updated date", () => {
    render(<SiteOverviewCard {...defaultProps} />);
    expect(screen.getByText(/Updated/)).toBeTruthy();
  });

  it("renders scan mode indicator", () => {
    render(<SiteOverviewCard {...defaultProps} scanMode="adhoc" />);
    expect(screen.getByText(/Adhoc scan/)).toBeTruthy();
  });

  it("renders per-standard wellness scores with correct badges", () => {
    render(<SiteOverviewCard {...defaultProps} />);
    expect(screen.getByText("SS 554")).toBeTruthy();
    expect(screen.getByText("WELL v2")).toBeTruthy();
    expect(screen.getByText("85")).toBeTruthy();
    expect(screen.getByText("70")).toBeTruthy();
  });

  it("renders overall wellness score", () => {
    render(<SiteOverviewCard {...defaultProps} />);
    expect(screen.getByText("78")).toBeTruthy();
  });

  it("shows worst outcome badge when a standard fails", () => {
    render(<SiteOverviewCard {...defaultProps} />);
    const actionRequiredElements = screen.getAllByText("Action Required");
    expect(actionRequiredElements.length).toBeGreaterThan(0);
  });

  it("shows Certified badge when all standards pass", () => {
    render(
      <SiteOverviewCard
        {...defaultProps}
        standardScores={[
          { sourceId: "ss554", title: "SS 554", score: 90, outcome: "PASS" },
        ]}
        overallWellness={90}
      />
    );
    // "Certified" appears in both the badge text and potentially elsewhere
    const certifiedElements = screen.getAllByText("Certified");
    expect(certifiedElements.length).toBeGreaterThan(0);
  });

  it("displays top insight when provided", () => {
    render(<SiteOverviewCard {...defaultProps} topInsight="High CO2 in Zone A" />);
    expect(screen.getByText("Top Insight")).toBeTruthy();
    expect(screen.getByText("High CO2 in Zone A")).toBeTruthy();
  });

  it("does not render insight section when topInsight is absent", () => {
    render(<SiteOverviewCard {...defaultProps} />);
    expect(screen.queryByText("Top Insight")).toBeNull();
  });

  it("handles null overall wellness", () => {
    render(<SiteOverviewCard {...defaultProps} overallWellness={null} />);
    // Should not crash, no score displayed
    expect(screen.getByText("Test Site")).toBeTruthy();
  });

  it("handles empty standard scores", () => {
    render(<SiteOverviewCard {...defaultProps} standardScores={[]} />);
    expect(screen.getByText("Test Site")).toBeTruthy();
    // No standards section should appear
    expect(screen.queryByText("Standards")).toBeNull();
  });
});
