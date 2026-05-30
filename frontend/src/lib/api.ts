import { config } from './config';
import { clearStoredAuth, getStoredToken } from '@/store/useChatStore';

type RequestBody =
  | BodyInit
  | Record<string, unknown>
  | unknown[]
  | number
  | boolean
  | null
  | undefined;

type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: RequestBody;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.api.baseUrl;
  }

  private isNativeBody(body: RequestBody): body is BodyInit {
    return (
      typeof body === 'string' ||
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body as ArrayBufferView) ||
      (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
    );
  }

  private getAuthHeaders(body?: RequestBody, headers: HeadersInit = {}): Headers {
    const mergedHeaders = new Headers(headers);
    const token = getStoredToken();

    if (token) {
      mergedHeaders.set('Authorization', `Bearer ${token}`);
    }

    const isBrowserManagedBody =
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body as ArrayBufferView) ||
      (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream);

    if (isBrowserManagedBody) {
      mergedHeaders.delete('Content-Type');
    } else if (!mergedHeaders.has('Content-Type')) {
      mergedHeaders.set('Content-Type', 'application/json');
    }

    return mergedHeaders;
  }

  private serializeBody(body?: RequestBody): BodyInit | undefined {
    if (body === null || body === undefined) {
      return undefined;
    }

    if (this.isNativeBody(body)) {
      return body;
    }

    return JSON.stringify(body);
  }

  private async parseResponse(response: Response): Promise<unknown> {
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return response.text();
    }

    return response.json().catch(() => ({}));
  }

  private getErrorMessage(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== 'object') {
      return fallback;
    }

    const record = payload as Record<string, unknown>;
    const message = record.message || record.msg || record.error;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }

  private handleUnauthorized(): void {
    clearStoredAuth();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:expired'));
    }
  }

  async request<T>(endpoint: string, init: ApiRequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...init,
        headers: this.getAuthHeaders(init.body as RequestBody | undefined, init.headers || {}),
        credentials: 'include',
        body: this.serializeBody(init.body as RequestBody | undefined),
      });

      const data = await this.parseResponse(response);

      if (response.status === 401) {
        this.handleUnauthorized();
      }

      if (!response.ok) {
        throw new ApiError(this.getErrorMessage(data, 'Request failed'), response.status);
      }

      if (data && typeof data === 'object' && 'data' in data) {
        return (data as { data: T }).data;
      }

      return data as T;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: RequestBody): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body,
    });
  }

  async put<T>(endpoint: string, body: RequestBody): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  }
}

export const api = new ApiClient();
export default api;
