// Shared types for the findings dashboard

export interface Finding {
  id: string;
  upload_id: string;
  site_id: string;
  zone_name: string;
  metric_name: string;
  metric_value: number;
  threshold_band: string;
  interpretation_text: string;
  workforce_impact_text: string;
  recommended_action: string;
  rule_id: string;
  rule_version: string;
  citation_unit_ids: string;
  confidence_level: string;
  source_currency_status: string;
  benchmark_lane: string;
  created_at: string;
}
