import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

// ==================== Types ====================

/** Payload for POST /api/auth/login */
export interface LoginPayload {
  email: string;
  password: string;
}

/** Payload for POST /api/auth/register */
export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  studentId?: string;
}

/** User profile returned by GET /api/auth/me */
export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  studentId?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Full auth response from login/OAuth callback.
 * Contains the JWT token and user profile info.
 */
export interface AuthResponse {
  user: UserProfile;
  access_token: string;
}

/** Linked OAuth account info from GET /api/auth/linked-accounts */
export interface LinkedAccount {
  provider: 'GITHUB' | 'GOOGLE';
  providerId: string;
  linkedAt: string;
}

// ==================== API Functions ====================

/** Login with email and password → POST /api/auth/login */
export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
  const response = await axiosClient.post<AuthResponse>(ENDPOINTS.AUTH.LOGIN, payload);
  return response.data;
};

/** Register a new user → POST /api/auth/register */
export const register = async (payload: RegisterPayload): Promise<UserProfile> => {
  const response = await axiosClient.post<UserProfile>(ENDPOINTS.AUTH.REGISTER, payload);
  return response.data;
};

/** Get current authenticated user profile → GET /api/auth/me */
export const getProfile = async (): Promise<UserProfile> => {
  const response = await axiosClient.get<UserProfile>(ENDPOINTS.AUTH.PROFILE);
  return response.data;
};

/** Get all linked OAuth accounts → GET /api/auth/linked-accounts */
export const getLinkedAccounts = async (): Promise<LinkedAccount[]> => {
  const response = await axiosClient.get<LinkedAccount[]>(ENDPOINTS.AUTH.LINKED_ACCOUNTS);
  return response.data;
};

/** Unlink an OAuth provider → DELETE /api/auth/unlink/{provider} */
export const unlinkProvider = async (provider: 'GITHUB' | 'GOOGLE'): Promise<void> => {
  await axiosClient.delete(ENDPOINTS.AUTH.UNLINK(provider));
};

/**
 * Build the GitHub OAuth URL to open in browser.
 * If token is provided, it will link the account instead of logging in.
 */
export const getGitHubAuthUrl = (token?: string): string => {
  const baseUrl = `${axiosClient.defaults.baseURL}${ENDPOINTS.AUTH.LINK_GITHUB}`;
  return token ? `${baseUrl}?token=${token}` : baseUrl;
};

/**
 * Build the Jira OAuth URL to open in browser.
 * TODO: Implement when Jira OAuth is ready on the backend.
 */
export const getJiraAuthUrl = (token?: string): string => {
  const baseUrl = `${axiosClient.defaults.baseURL}/api/auth/jira`;
  return token ? `${baseUrl}?token=${token}` : baseUrl;
};
