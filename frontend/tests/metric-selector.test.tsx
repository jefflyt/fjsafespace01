import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetricSelector } from "@/components/MetricSelector";

describe("MetricSelector", () => {
  const availableMetrics = ["co2_ppm", "pm25_ugm3", "temperature_c"];

  it("renders checkboxes for all metrics", () => {
    const handleToggle = vi.fn();
    render(
      <MetricSelector
        availableMetrics={availableMetrics}
        activeMetrics={[]}
        onToggle={handleToggle}
      />
    );
    // Check that all three metrics render with their symbols
    expect(screen.getAllByRole("checkbox").length).toBe(3);
    expect(screen.getByText("PM2.5")).toBeTruthy();
    expect(screen.getByText("Temp")).toBeTruthy();
  });

  it("shows label next to symbol when available", () => {
    const handleToggle = vi.fn();
    render(
      <MetricSelector
        availableMetrics={availableMetrics}
        activeMetrics={[]}
        onToggle={handleToggle}
      />
    );
    // temperature_c has label "Temperature" which differs from symbol "Temp"
    // The component renders: Temp (Temperature)
    expect(screen.getByText(/Temperature/)).toBeTruthy();
  });

  it("toggling checkbox calls onToggle", () => {
    const handleToggle = vi.fn();
    render(
      <MetricSelector
        availableMetrics={availableMetrics}
        activeMetrics={[]}
        onToggle={handleToggle}
      />
    );
    const checkbox = screen.getByRole("checkbox", { name: /CO₂/ });
    fireEvent.click(checkbox);
    expect(handleToggle).toHaveBeenCalledWith("co2_ppm");
  });

  it("renders active metrics as checked", () => {
    const handleToggle = vi.fn();
    render(
      <MetricSelector
        availableMetrics={availableMetrics}
        activeMetrics={["co2_ppm"]}
        onToggle={handleToggle}
      />
    );
    const checkbox = screen.getByRole("checkbox", { name: /CO₂/ });
    expect(checkbox).toBeChecked();
  });

  it("renders inactive metrics as unchecked", () => {
    const handleToggle = vi.fn();
    render(
      <MetricSelector
        availableMetrics={availableMetrics}
        activeMetrics={["co2_ppm"]}
        onToggle={handleToggle}
      />
    );
    const checkbox = screen.getByRole("checkbox", { name: /PM2.5/ });
    expect(checkbox).not.toBeChecked();
  });

  it("handles empty available metrics", () => {
    const handleToggle = vi.fn();
    const { container } = render(
      <MetricSelector
        availableMetrics={[]}
        activeMetrics={[]}
        onToggle={handleToggle}
      />
    );
    // Should render without crashing — just an empty container
    expect(container.querySelector(".space-y-2")).toBeTruthy();
  });
});
