/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WellnessIndexCard } from '@/components/WellnessIndexCard';

describe('WellnessIndexCard', () => {
  it('renders site name and score', () => {
    render(
      <WellnessIndexCard
        siteName="Test Site"
        wellnessIndexScore={85}
        certificationOutcome="HEALTHY_WORKPLACE_CERTIFIED"
        lastScanDate="2026-04-01T10:00:00Z"
      />
    );

    expect(screen.getByText('Test Site')).toBeTruthy();
    expect(screen.getByText('85')).toBeTruthy();
    expect(screen.getByText('/ 100')).toBeTruthy();
  });

  it('shows N/A when score is null', () => {
    render(
      <WellnessIndexCard
        siteName="Empty Site"
        wellnessIndexScore={null}
        certificationOutcome={null}
      />
    );

    expect(screen.getByText('N/A')).toBeTruthy();
  });

  it('shows certified badge for HEALTHY_WORKPLACE_CERTIFIED', () => {
    render(
      <WellnessIndexCard
        siteName="Certified Site"
        wellnessIndexScore={90}
        certificationOutcome="HEALTHY_WORKPLACE_CERTIFIED"
      />
    );

    expect(screen.getByText('Certified')).toBeTruthy();
  });

  it('shows insufficient evidence for unknown outcome', () => {
    render(
      <WellnessIndexCard
        siteName="Unknown Site"
        wellnessIndexScore={30}
        certificationOutcome="UNKNOWN_STATUS"
      />
    );

    expect(screen.getByText('Insufficient Evidence')).toBeTruthy();
  });

  it('displays last scan date when provided', () => {
    render(
      <WellnessIndexCard
        siteName="Dated Site"
        wellnessIndexScore={70}
        certificationOutcome="HEALTHY_SPACE_VERIFIED"
        lastScanDate="2026-03-15T08:00:00Z"
      />
    );

    expect(screen.getByText(/Last scan:/i)).toBeTruthy();
  });

  it('shows no scan message when lastScanDate is null', () => {
    render(
      <WellnessIndexCard
        siteName="No Scan Site"
        wellnessIndexScore={50}
        certificationOutcome="IMPROVEMENT_REQUIRED"
        lastScanDate={null}
      />
    );

    expect(screen.getByText(/No scan data available/i)).toBeTruthy();
  });
});
