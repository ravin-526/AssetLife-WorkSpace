import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import useUserStore from "../store/userStore.ts";

type ApiErrorBody = {
  detail?: string | {
    status?: string;
    message?: string;
    errors?: Array<{
      loc?: Array<string | number>;
      msg?: string;
      type?: string;
    }>;
  };
  status?: string;
  message?: string;
  error?: {
    message?: string;
  };
};

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
export const API_BASE_URL = runtimeEnv?.REACT_APP_API_BASE_URL ?? "http://localhost:8000";
const ACCESS_TOKEN_KEY = "access_token";
const LEGACY_TOKEN_KEY = "jwt_token";

export const getAuthorizationHeader = (): Record<string, string> => {
  const tokenFromStorage = localStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
  const token = useUserStore.getState().token ?? tokenFromStorage;
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
};

const extractErrorMessage = (error: AxiosError<ApiErrorBody>): string => {
  const status = error.response?.status;
  const detail = error.response?.data?.detail;
  const detailMessage = typeof detail === "string" ? detail : detail?.message;
  const detailErrors = typeof detail === "object" ? detail?.errors : undefined;
  const firstDetailError = detailErrors && detailErrors.length > 0 ? detailErrors[0] : undefined;
  const message =
    firstDetailError?.msg ||
    detailMessage ||
    error.response?.data?.message ||
    error.response?.data?.error?.message;

  if (message) {
    return message;
  }

  if (status === 401) {
    return "Unauthorized. Please login again.";
  }
  if (status === 404) {
    return "Requested resource was not found.";
  }
  if (status) {
    return `Request failed with status ${status}`;
  }

  return (
    error.message ||
    "Something went wrong"
  );
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authHeader = getAuthorizationHeader();
    if (authHeader.Authorization) {
      config.headers.Authorization = authHeader.Authorization;
    }

    // Debug: Log token used in API requests
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    console.log("API Request Token:", token);

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      useUserStore.getState().logout();
      window.location.href = "/login";
    }

    // When responseType is "blob", error.response.data is a Blob and .detail can't be read directly
    if (error.response?.data instanceof Blob) {
      try {
        const text = await (error.response.data as Blob).text();
        const parsed = JSON.parse(text) as { detail?: unknown };
        if (parsed.detail) {
          return Promise.reject(new Error(String(parsed.detail)));
        }
      } catch {
        // fall through to generic error handling
      }
    }

    return Promise.reject(new Error(extractErrorMessage(error as AxiosError<ApiErrorBody>)));
  }
);

export default api;