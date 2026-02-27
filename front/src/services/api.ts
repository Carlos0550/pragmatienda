// API Service Layer for PRAGMATIENDA
// All API calls go through this service with tenant and auth headers (axios)
// Token is stored in cookies and sent in Authorization header

import axios from 'axios';
import { getTokenCookie, removeTokenCookie, setTokenCookie } from '@/lib/cookies';
import type { ApiError, ApiRequestBody, QueryParams } from '@/types';
export type { ApiError } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiService {
  private tenantId: string | null = null;
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;
  private onBillingRequired: (() => void) | null = null;

  private client = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  constructor() {
    this.client.interceptors.request.use((config) => {
      if (this.tenantId) {
        config.headers['x-tenant-id'] = this.tenantId;
      }
      const t = this.getToken();
      if (t) {
        config.headers.Authorization = `Bearer ${t}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        if (response.status === 204) return { ...response, data: {} };
        return response;
      },
      (error) => {
        if (!error.response) {
          return Promise.reject({
            status: 0,
            message: error.message || 'Error de red',
          } as ApiError);
        }
        const status = error.response.status;
        const data = error.response.data ?? {};
        const payload = data as {
          message?: string;
          err?: Record<string, string[]>;
          result?: { message?: string; err?: Record<string, string[]> };
        };
        const backendMessage = payload.message || payload.result?.message || 'Error del servidor';
        const backendErrors = payload.err || payload.result?.err;
        if (status === 401) {
          this.onUnauthorized?.();
          return Promise.reject({ status: 401, message: backendMessage || 'Sesión expirada', errors: backendErrors } as ApiError);
        }
        if (status === 402) {
          this.onBillingRequired?.();
          return Promise.reject({ status: 402, message: backendMessage || 'Suscripción requerida', errors: backendErrors } as ApiError);
        }
        if (status === 403) {
          return Promise.reject({ status: 403, message: backendMessage || 'Acceso denegado', errors: backendErrors } as ApiError);
        }
        return Promise.reject({
          status,
          message: backendMessage,
          errors: backendErrors,
        } as ApiError);
      }
    );
  }

  setTenantId(id: string) {
    this.tenantId = id;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      setTokenCookie(token);
    } else {
      removeTokenCookie();
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = getTokenCookie();
    }
    return this.token;
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  setOnBillingRequired(callback: () => void) {
    this.onBillingRequired = callback;
  }

  async get<T>(path: string, params?: QueryParams): Promise<T> {
    const res = await this.client.get<T>(path, { params });
    return res.data;
  }

  async post<T>(path: string, body?: ApiRequestBody): Promise<T> {
    const res = await this.client.post<T>(path, body);
    return res.data;
  }

  async patch<T>(path: string, body?: ApiRequestBody): Promise<T> {
    const res = await this.client.patch<T>(path, body);
    return res.data;
  }

  async put<T>(path: string, body?: ApiRequestBody): Promise<T> {
    const res = await this.client.put<T>(path, body);
    return res.data;
  }

  async delete<T>(path: string): Promise<T> {
    const res = await this.client.delete<T>(path);
    return res.data;
  }

  async postMultipart<T>(path: string, formData: FormData): Promise<T> {
    const res = await this.client.post<T>(path, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  async putMultipart<T>(path: string, formData: FormData): Promise<T> {
    const res = await this.client.put<T>(path, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }
}

export const api = new ApiService();
