import type { LoginRequest, LoginResponse } from '../types/auth';
import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  return apiService.post<LoginResponse>(ENDPOINTS.auth.login, payload);
}

export async function logout(): Promise<void> {
  await apiService.post(ENDPOINTS.auth.logout, {});
  apiService.setAuthToken(null);
}

export async function session() {
  return apiService.get(ENDPOINTS.auth.session);
}

export async function roles() {
  return apiService.get(ENDPOINTS.auth.roles);
}

export async function changePassword(oldPassword: string, newPassword: string) {
  return apiService.post(ENDPOINTS.auth.changePassword, { oldPassword, newPassword });
}

export async function verifyPassword(password: string) {
  return apiService.post(ENDPOINTS.auth.verifyPassword, { password });
}

export default { login, logout, session, roles, changePassword, verifyPassword };
