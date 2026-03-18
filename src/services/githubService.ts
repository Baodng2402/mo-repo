import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';
import type {
  GitHubCommit,
  ContributorStat,
  CreateRepoPayload,
  CreateRepoResponse,
} from '../types/github';

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

/**
 * Create a new GitHub repository
 * POST /api/github/repos
 */
export const createRepository = async (payload: CreateRepoPayload): Promise<CreateRepoResponse> => {
  const response = await axiosClient.post<CreateRepoResponse>(
    ENDPOINTS.GITHUB.CREATE_REPO,
    payload
  );
  return response.data;
};

/**
 * Get commit history for a repository
 * GET /api/github/repos/:owner/:repo/commits
 */
export const getCommits = async (owner: string, repo: string): Promise<GitHubCommit[]> => {
  const response = await axiosClient.get<GitHubCommit[]>(ENDPOINTS.GITHUB.COMMITS(owner, repo));
  return response.data;
};

/**
 * Get total commits and LOC changes per developer
 * GET /api/github/repos/:owner/:repo/contributors-stats
 */
export const getContributorStats = async (
  owner: string,
  repo: string
): Promise<ContributorStat[]> => {
  const response = await axiosClient.get<ContributorStat[]>(
    ENDPOINTS.GITHUB.CONTRIBUTOR_STATS(owner, repo)
  );
  return response.data;
};
