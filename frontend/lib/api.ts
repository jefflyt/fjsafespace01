/**
 * frontend/lib/api.ts
 *
 * Centralized fetch client for the FastAPI backend.
 * Supports optional auth token injection via api.withToken(token).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface FetchOptions extends RequestInit {
  authToken?: string;
}

async function fetcher<T>(endpoint: string, options?: FetchOptions): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const isFormData = options?.body instanceof FormData;

  const headers: Record<string, string> = isFormData
    ? { ...(options?.headers as Record<string, string> || {}) }
    : {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> || {}),
      };

  if (options?.authToken) {
    headers['Authorization'] = `Bearer ${options.authToken}`;
  }

  const { authToken, ...restOptions } = options || {};

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail = errorBody?.detail;
    let message: string;
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ');
    } else {
      message = response.statusText || 'An error occurred';
    }
    throw new Error(message);
  }

  return response.json();
}

function createApi(authToken?: string) {
  const opts = authToken ? { authToken } : undefined;

  return {
    get: <T>(endpoint: string, options?: FetchOptions) =>
      fetcher<T>(endpoint, { ...options, ...opts, method: 'GET' }),

    post: <T>(endpoint: string, body: any, options?: FetchOptions) =>
      fetcher<T>(endpoint, { ...options, ...opts, method: 'POST', body: JSON.stringify(body) }),

    upload: <T>(endpoint: string, formData: FormData, options?: FetchOptions) =>
      fetcher<T>(endpoint, {
        ...options,
        ...opts,
        method: 'POST',
        body: formData,
        headers: {
          ...(options?.headers as Record<string, string> || {}),
        },
      }),

    patch: <T>(endpoint: string, body: any, options?: FetchOptions) =>
      fetcher<T>(endpoint, { ...options, ...opts, method: 'PATCH', body: JSON.stringify(body) }),

    delete: <T>(endpoint: string, options?: FetchOptions) =>
      fetcher<T>(endpoint, { ...options, ...opts, method: 'DELETE' }),
  };
}

// Default API instance without auth token (backward compatible)
export const api = createApi();

// Factory method for authenticated API calls
export const apiWithToken = (token: string) => createApi(token);

// ── R1-04: Typed API functions ──────────────────────────────────────────────

export interface MetricPreferences {
  site_id: string;
  active_metrics: string[];
  alert_threshold_overrides: Record<string, any>;
}

export interface MetricPreferencesUpdate {
  active_metrics?: string[];
  alert_threshold_overrides?: Record<string, any>;
}

export interface SiteStandard {
  source_id: string;
  title: string;
  is_active: boolean;
}

export interface SiteStandards {
  site_id: string;
  standards: SiteStandard[];
}

export interface Interpretation {
  metric_name: string;
  threshold_band: string;
  interpretation: string;
  business_impact: string;
  recommendation: string;
  context_scope: string;
}

export const apiClient = {
  // Metric Preferences
  getSitesMetricPreferences: (siteId: string, options?: FetchOptions) =>
    api.get<MetricPreferences>(`/api/sites/${siteId}/metric-preferences`, options),

  updateSitesMetricPreferences: (siteId: string, body: MetricPreferencesUpdate, options?: FetchOptions) =>
    api.patch<MetricPreferences>(`/api/sites/${siteId}/metric-preferences`, body, options),

  // Site Standards
  getSitesStandards: (siteId: string, options?: FetchOptions) =>
    api.get<SiteStandards>(`/api/sites/${siteId}/standards`, options),

  activateStandard: (siteId: string, sourceId: string, options?: FetchOptions) =>
    api.post<void>(`/api/sites/${siteId}/standards/${sourceId}/activate`, {}, options),

  deactivateStandard: (siteId: string, sourceId: string, options?: FetchOptions) =>
    api.post<void>(`/api/sites/${siteId}/standards/${sourceId}/deactivate`, {}, options),

  // Interpretations
  getInterpretation: (metricName: string, thresholdBand: string, contextScope?: string, options?: FetchOptions) =>
    api.get<Interpretation>(
      `/api/interpretations/${metricName}/${thresholdBand}${contextScope ? `?context_scope=${contextScope}` : ''}`,
      options,
    ),
};
