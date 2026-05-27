import axios, { AxiosError } from 'axios';

export const ACCESS_TOKEN_KEY = 'tax_crm_access_token';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (resp) => resp,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export type ApiEnvelope<T> = { data: T; error?: never } | { data?: never; error: { message: string; code?: string } };

export function unwrap<T>(payload: ApiEnvelope<T>): T {
  if ('error' in payload && payload.error) {
    throw new Error(payload.error.message);
  }
  return payload.data as T;
}
