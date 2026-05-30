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

type ApiResponsePayload = unknown;

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

  private async parseResponse(response: Response): Promise<ApiResponsePayload> {
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!text) {
      return null;
    }

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return text;
  }

  private getErrorMessage(payload: unknown, fallback: string): string {
    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      if (!trimmed || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
        return fallback;
      }
      return trimmed.length > 160 ? fallback : trimmed;
    }

    if (!payload || typeof payload !== 'object') {
      return fallback;
    }

    const record = payload as Record<string, unknown>;
    const message = record.message || record.msg || record.error;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }

  private getFallbackErrorMessage(response: Response): string {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return '服务暂时不可用，请稍后重试';
    }
    if (response.status === 500) {
      return '服务器内部错误，请稍后重试';
    }
    if (response.status === 404) {
      return '请求的接口不存在';
    }
    if (response.status === 429) {
      return '请求太频繁，请稍后再试';
    }
    return response.statusText || '请求失败';
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
        const fallback = this.getFallbackErrorMessage(response);
        throw new ApiError(this.getErrorMessage(data, fallback), response.status);
      }

      if (data && typeof data === 'object' && 'data' in data) {
        return (data as { data: T }).data;
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof TypeError) {
        throw new ApiError('无法连接服务器，请检查网络或稍后重试', 0);
      }
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
