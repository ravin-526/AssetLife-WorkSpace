import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import useUserStore from "../store/userStore.ts";

type ApiErrorBody = {
  detail?: string;
  message?: string;
  error?: {
    message?: string;
  };
};

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? "http://192.168.0.14:8000";

export const getAuthorizationHeader = (): Record<string, string> => {
  const token = useUserStore.getState().token;
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
};

const extractErrorMessage = (error: AxiosError<ApiErrorBody>): string => {
  const status = error.response?.status;
  const detail =
    error.response?.data?.detail ||
    error.response?.data?.message ||
    error.response?.data?.error?.message;

  if (detail) {
    return detail;
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

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useUserStore.getState().logout();
      window.location.href = "/login";
    }

    return Promise.reject(new Error(extractErrorMessage(error as AxiosError<ApiErrorBody>)));
  }
);

export default api;