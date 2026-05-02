import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "@/components/MetricCard";

describe("MetricCard", () => {
  const defaultProps = {
    metricName: "co2_ppm",
    metricValue: 1200,
    metricUnit: "ppm",
    thresholdBand: "CRITICAL" as const,
    interpretationText: "CO2 levels are elevated.",
    recommendedAction: "Increase ventilation.",
    workforceImpactText: "Reduced cognitive performance.",
  };

  it("renders metric value and unit", () => {
    render(<MetricCard {...defaultProps} />);
    expect(screen.getByText("1200")).toBeTruthy();
    expect(screen.getByText("ppm")).toBeTruthy();
  });

  it("renders metric symbol from config", () => {
    render(<MetricCard {...defaultProps} />);
    expect(screen.getByText("CO₂")).toBeTruthy();
  });

  it("renders interpretation text", () => {
    render(<MetricCard {...defaultProps} />);
    expect(screen.getByText("CO2 levels are elevated.")).toBeTruthy();
  });

  it("renders recommended action", () => {
    render(<MetricCard {...defaultProps} />);
    expect(screen.getByText("Recommended action:")).toBeTruthy();
    expect(screen.getByText("Increase ventilation.")).toBeTruthy();
  });

  it("renders workforce impact when provided", () => {
    render(<MetricCard {...defaultProps} />);
    expect(screen.getByText("Impact:")).toBeTruthy();
    expect(screen.getByText("Reduced cognitive performance.")).toBeTruthy();
  });

  it("does not render workforce impact when absent", () => {
    render(<MetricCard {...defaultProps} workforceImpactText={undefined} />);
    expect(screen.queryByText("Impact:")).toBeNull();
  });

  it("shows Action Required badge for CRITICAL band", () => {
    render(<MetricCard {...defaultProps} />);
    expect(screen.getByText("Action Required")).toBeTruthy();
  });

  it("shows Healthy badge for GOOD band", () => {
    render(<MetricCard {...defaultProps} thresholdBand="GOOD" metricValue={500} />);
    expect(screen.getByText("Healthy")).toBeTruthy();
  });

  it("shows Attention badge for WATCH band", () => {
    render(<MetricCard {...defaultProps} thresholdBand="WATCH" metricValue={900} />);
    expect(screen.getByText("Attention")).toBeTruthy();
  });

  it("falls back to metricName when config not found", () => {
    render(
      <MetricCard
        {...defaultProps}
        metricName="unknown_metric"
        metricValue={42}
        metricUnit="units"
      />
    );
    expect(screen.getByText("unknown_metric")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });
});
