// API Service Layer for PRAGMATIENDA
// All API calls go through this service with tenant and auth headers

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

class ApiService {
  private tenantId: string | null = null;
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;
  private onBillingRequired: (() => void) | null = null;

  setTenantId(id: string) {
    this.tenantId = id;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('pragmatienda_token', token);
    } else {
      localStorage.removeItem('pragmatienda_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('pragmatienda_token');
    }
    return this.token;
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  setOnBillingRequired(callback: () => void) {
    this.onBillingRequired = callback;
  }

  private getHeaders(isMultipart = false): HeadersInit {
    const headers: HeadersInit = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.tenantId) {
      headers['x-tenant-id'] = this.tenantId;
    }
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      this.onUnauthorized?.();
      throw { status: 401, message: 'Sesión expirada' } as ApiError;
    }
    if (response.status === 402) {
      this.onBillingRequired?.();
      throw { status: 402, message: 'Suscripción requerida' } as ApiError;
    }
    if (response.status === 403) {
      throw { status: 403, message: 'Acceso denegado' } as ApiError;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: data.message || 'Error del servidor',
        errors: data.err,
      } as ApiError;
    }
    if (response.status === 204) return {} as T;
    return response.json();
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const res = await fetch(url.toString(), { headers: this.getHeaders() });
    return this.handleResponse<T>(res);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(res);
  }

  async postMultipart<T>(path: string, formData: FormData): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse<T>(res);
  }
}

export const api = new ApiService();
export type { ApiError };
