/**
 * frontend/lib/api.ts
 * 
 * Centralized fetch client for the FastAPI backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Don't set Content-Type for FormData uploads - browser handles it with boundary
  const isFormData = options?.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    headers: isFormData
      ? { ...options?.headers }
      : {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
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

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    fetcher<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body: any, options?: RequestInit) =>
    fetcher<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),

  /**
   * Upload a file using multipart/form-data.
   * Do NOT set Content-Type header — browser will set it with the boundary.
   */
  upload: <T>(endpoint: string, formData: FormData, options?: RequestInit) =>
    fetcher<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
      headers: {
        // Omit Content-Type — browser sets it with boundary
        ...options?.headers,
      },
    }),

  patch: <T>(endpoint: string, body: any, options?: RequestInit) =>
    fetcher<T>(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    fetcher<T>(endpoint, { ...options, method: 'DELETE' }),
};
