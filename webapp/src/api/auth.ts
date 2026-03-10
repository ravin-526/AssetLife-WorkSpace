import api from "../services/api";

export type LoginRequest = {
  mobile: string;
  otp: string;
};

export type LoginResponse = {
  access_token?: string;
  token?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
  };
  message?: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  mobile: string;
  dob: string;
  pan: string;
};

export type RegisterResponse = {
  message?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
  };
};

export const loginIndividual = async (payload: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>("/individual/verify-otp", payload);
  return response.data;
};

export const registerIndividual = async (payload: RegisterRequest): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>("/individual/register", payload);
  return response.data;
};
