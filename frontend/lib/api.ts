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
