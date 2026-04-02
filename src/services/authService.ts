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

type RawUserProfile = {
  id: string;
  email: string;
  fullName?: string;
  full_name?: string;
  studentId?: string;
  student_id?: string;
  role: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

/**
 * Full auth response from login/OAuth callback.
 * Contains the JWT token and user profile info.
 */
export interface AuthResponse {
  user: UserProfile;
  access_token: string;
}

const normalizeUserProfile = (raw: RawUserProfile): UserProfile => ({
  id: raw.id,
  email: raw.email,
  fullName: raw.fullName ?? raw.full_name ?? '',
  studentId: raw.studentId ?? raw.student_id,
  role: raw.role,
  createdAt: raw.createdAt ?? raw.created_at ?? '',
  updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
});

const normalizeAuthResponse = (raw: {
  user: RawUserProfile;
  access_token: string;
}): AuthResponse => ({
  access_token: raw.access_token,
  user: normalizeUserProfile(raw.user),
});

/** Linked OAuth account info from GET /api/auth/linked-accounts */
export interface LinkedAccount {
  provider: 'GITHUB' | 'JIRA';
  provider_username: string;
  provider_email: string;
  created_at: Date;
}

// ==================== API Functions ====================

/** Login with email and password → POST /api/auth/login */
export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
  const response = await axiosClient.post<{ user: RawUserProfile; access_token: string }>(
    ENDPOINTS.AUTH.LOGIN,
    payload
  );
  return normalizeAuthResponse(response.data);
};

/** Register a new user → POST /api/auth/register */
export const register = async (payload: RegisterPayload): Promise<UserProfile> => {
  const response = await axiosClient.post<RawUserProfile>(ENDPOINTS.AUTH.REGISTER, payload);
  return normalizeUserProfile(response.data);
};

/** Get current authenticated user profile → GET /api/auth/me */
export const getProfile = async (): Promise<UserProfile> => {
  const response = await axiosClient.get<RawUserProfile>(ENDPOINTS.AUTH.PROFILE);
  return normalizeUserProfile(response.data);
};

/** Get all linked OAuth accounts → GET /api/auth/linked-accounts */
export const getLinkedAccounts = async (): Promise<LinkedAccount[]> => {
  const response = await axiosClient.get<LinkedAccount[]>(ENDPOINTS.AUTH.LINKED_ACCOUNTS);
  return response.data;
};

/** Unlink an OAuth provider → DELETE /api/auth/unlink/{provider} */
export const unlinkProvider = async (provider: 'GITHUB' | 'JIRA'): Promise<void> => {
  await axiosClient.delete(ENDPOINTS.AUTH.UNLINK(provider));
};

/**
 * Build the GitHub OAuth URL to open in browser.
 * redirectUri is required by backend to validate callback origin.
 */
export const getGitHubAuthUrl = (token?: string, redirectUri?: string): string => {
  const baseUrl = `${axiosClient.defaults.baseURL}${ENDPOINTS.AUTH.LINK_GITHUB}`;
  const params = new URLSearchParams();

  if (redirectUri) params.set('redirect_uri', redirectUri);
  if (token) params.set('token', token);

  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
};

/**
 * Build the Jira OAuth URL to open in browser.
 * redirectUri is required by backend to validate callback origin.
 */
export const getJiraAuthUrl = (token?: string, redirectUri?: string): string => {
  const baseUrl = `${axiosClient.defaults.baseURL}${ENDPOINTS.AUTH.LINK_JIRA}`;
  const params = new URLSearchParams();

  if (redirectUri) params.set('redirect_uri', redirectUri);
  if (token) params.set('token', token);

  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
};
