import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import * as authService from '../services/authService';
import type { LoginRequest, LoginResponse } from '../types/auth';

type ChangePasswordPayload = {
  oldPassword: string;
  newPassword: string;
};

export function useLogin() {
  const qc = useQueryClient();
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: (payload: LoginRequest) => authService.login(payload),
    onSuccess: (res: LoginResponse) => {
        const user = res.user || (res as any).data?.user;
        const token = res.token || (res as any).data?.token;

        // Set token on apiService so subsequent requests include Authorization header
        if (token) {
          apiService.setAuthToken(token);
          try {
            localStorage.setItem('rosaGardensToken', token);
          } catch (e) {
            // ignore storage errors
          }
        }

        // Notify AuthProvider of the user — server sets httpOnly cookie
        if (user) {
          try {
            localStorage.setItem('rosaGardensAuth', 'true');
            localStorage.setItem('rosaGardensUser', JSON.stringify(user));
            const event = new CustomEvent('userLogin', { detail: { user } });
            window.dispatchEvent(event);
          } catch (e) {
            // ignore storage errors
          }
        }

        qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      apiService.setAuthToken(null);
      qc.clear();
    },
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation<any, Error, ChangePasswordPayload>({
    mutationFn: ({ oldPassword, newPassword }: ChangePasswordPayload) =>
      authService.changePassword(oldPassword, newPassword),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useVerifyPassword() {
  return useMutation<any, Error, string>({
    mutationFn: (password: string) => authService.verifyPassword(password),
  });
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => authService.session(),
    retry: false,
  });
}
