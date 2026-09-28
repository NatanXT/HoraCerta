import { api } from './api';

export interface UserDto {
  id: string;
  name: string;
  email: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<UserDto> {
    const response = await api.post<UserDto>('/api/auth/register', payload);
    return response.data;
  },

  async login(payload: LoginPayload): Promise<UserDto> {
    const response = await api.post<UserDto>('/api/auth/login', payload);
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
  },

  async me(): Promise<UserDto> {
    const response = await api.get<UserDto>('/api/auth/me');
    return response.data;
  },
};
