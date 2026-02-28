export interface User {
  id: number;
  staffId?: string;
  role: string;
}

export interface LoginRequest {
  staffId?: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
  user?: User;
  error?: boolean;
  data?: any;
}
