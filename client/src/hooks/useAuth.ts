import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import * as authService from '../services/services/authService';
import type { LoginRequest, LoginResponse } from '../types/auth';

export function useLogin() {
  const qc = useQueryClient();
  return useMutation((payload: LoginRequest) => authService.login(payload), {
    onSuccess: (res: LoginResponse) => {
      const token = res.token || (res as any).data?.token;
      if (token) {
        apiService.setAuthToken(token);
      }
      qc.invalidateQueries(['session']);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation(() => authService.logout(), {
    onSuccess: () => {
      apiService.setAuthToken(null);
      qc.clear();
    },
  });
}

export function useSession() {
  return useQuery(['session'], () => authService.session(), { retry: false });
}
