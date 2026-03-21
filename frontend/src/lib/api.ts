import { config } from './config';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: number;
    message: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.api.baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async get<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include', // 包含Cookie
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Request failed');
      }

      return data.data as T;
    } catch (error) {
      console.error('GET request error:', error);
      throw error;
    }
  }

  async post<T>(endpoint: string, body: any): Promise<T> {
    try {
      console.log("正在请求地址:", `${this.baseUrl}${endpoint}`);
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include', // 包含Cookie
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Request failed');
      }

      return data.data as T;
    } catch (error) {
      console.error('POST request error:', error);
      throw error;
    }
  }

  async put<T>(endpoint: string, body: any): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        credentials: 'include', // 包含Cookie
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Request failed');
      }

      return data.data as T;
    } catch (error) {
      console.error('PUT request error:', error);
      throw error;
    }
  }

  async delete<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        credentials: 'include', // 包含Cookie
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Request failed');
      }

      return data.data as T;
    } catch (error) {
      console.error('DELETE request error:', error);
      throw error;
    }
  }
}

export const api = new ApiClient();
export default api;