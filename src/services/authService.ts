import { authApi, UnifiedUser, UserRole } from '../api/authApi';

export type User = UnifiedUser;

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}

export const authService = {
  getStoredUser(): User | null {
    return authApi.getStoredUser();
  },

  logout(): void {
    authApi.logout();
  },

  async signup(data: {
    name: string;
    testIdentityNumber: string;
    mobileNumber: string;
    password?: string;
    role?: UserRole;
  }): Promise<AuthResponse> {
    const user = await authApi.loginCustom({
      identifier: data.mobileNumber || data.testIdentityNumber,
      name: data.name,
      password: data.password,
      role: data.role || 'CITIZEN',
    });
    const token = localStorage.getItem('stride_token') || '';
    return { token, user };
  },

  async login(data: {
    testIdentityNumber?: string;
    mobileNumber?: string;
    name?: string;
    password?: string;
    role?: UserRole;
  }): Promise<AuthResponse> {
    const identifier = data.mobileNumber || data.testIdentityNumber || '9800000011';
    const user = await authApi.loginCustom({
      identifier,
      name: data.name,
      password: data.password,
      role: data.role || 'CITIZEN',
    });
    const token = localStorage.getItem('stride_token') || '';
    return { token, user };
  },

  async getMe(): Promise<{ user: User }> {
    const user = authApi.getStoredUser();
    if (!user) throw new Error('Not authenticated');
    return { user };
  },
};
