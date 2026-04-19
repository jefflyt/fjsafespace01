/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WellnessIndexCard } from '@/components/WellnessIndexCard';

// Mock the api module for components that use it
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

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

describe('CitationBadge', () => {
  it('renders rule ID', async () => {
    const { CitationBadge } = await import('@/components/CitationBadge');

    render(
      <CitationBadge
        citationUnitIds={['cit-001', 'cit-002']}
        ruleId="rule-co2-001"
        ruleVersion="v1.0"
        sourceCurrencyStatus="CURRENT_VERIFIED"
      />
    );

    expect(screen.getByText('rule-co2-001')).toBeTruthy();
  });
});

describe('CrossSiteComparisonTable', () => {
  it('renders empty state message', async () => {
    const { CrossSiteComparisonTable } = await import('@/components/CrossSiteComparisonTable');

    render(<CrossSiteComparisonTable sites={[]} />);

    expect(screen.getByText(/No sites available/i)).toBeTruthy();
  });

  it('renders sites with correct data', async () => {
    const { CrossSiteComparisonTable } = await import('@/components/CrossSiteComparisonTable');

    render(
      <CrossSiteComparisonTable
        sites={[
          {
            site_id: 'site-1',
            site_name: 'Site A',
            wellness_index_score: 85,
            certification_outcome: 'HEALTHY_WORKPLACE_CERTIFIED',
            last_scan_date: '2026-04-01T10:00:00Z',
          },
        ]}
      />
    );

    expect(screen.getByText('Site A')).toBeTruthy();
    expect(screen.getByText('85')).toBeTruthy();
    expect(screen.getByText('Certified')).toBeTruthy();
  });
});

describe('DailySummaryCard', () => {
  it('renders empty state when no risks or actions', async () => {
    const { DailySummaryCard } = await import('@/components/DailySummaryCard');

    render(<DailySummaryCard topRisks={[]} topActions={[]} />);

    expect(screen.getByText(/No critical risks/i)).toBeTruthy();
    expect(screen.getByText(/No actions required/i)).toBeTruthy();
  });

  it('renders risks and actions when provided', async () => {
    const { DailySummaryCard } = await import('@/components/DailySummaryCard');

    render(
      <DailySummaryCard
        topRisks={[{ metric: 'CO2', zone: 'Lobby', severity: 'CRITICAL', value: '900 ppm' }]}
        topActions={[{ action: 'Ventilation boost', zone: 'Lobby', priority: 'HIGH' }]}
        dataAsOf="2026-04-01T10:00:00Z"
      />
    );

    expect(screen.getByText('CO2')).toBeTruthy();
    expect(screen.getByText('Ventilation boost')).toBeTruthy();
  });
});

describe('TrendChart', () => {
  it('renders empty message when no data', async () => {
    const { TrendChart } = await import('@/components/TrendChart');

    render(<TrendChart data={[]} emptyMessage="No trend data." />);

    expect(screen.getByText('No trend data.')).toBeTruthy();
  });
});
