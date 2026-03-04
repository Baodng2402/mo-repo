import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  updated_at: string;
}

export interface GetReposResponse {
  total_repos: number;
  repositories: GitHubRepo[];
}

/**
 * Get user's linked GitHub repositories
 * GET /api/github/repos
 */
export const getRepositories = async (): Promise<GetReposResponse> => {
  const response = await axiosClient.get<GetReposResponse>(ENDPOINTS.GITHUB.REPOS);
  return response.data;
};
