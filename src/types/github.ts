// ==================== GitHub Commit ====================

export interface GitHubCommit {
  sha: string;
  author: string;
  date: string;
  message: string;
  avatar_url?: string;
}

// ==================== Contributor Stats ====================

export interface ContributorStat {
  author: string;
  developer_id: number;
  avatar_url?: string;
  commits: number;
  lines_added: number;
  lines_deleted: number;
  net_change: number;
}

// ==================== Group Repository ====================

export interface GroupRepo {
  id: string;
  group_id: string;
  repo_url: string;
  repo_name: string;
  repo_owner: string;
  is_primary: boolean;
  added_by_id: string;
  created_at: string;
}

export interface LinkRepoPayload {
  repo_url: string;
  repo_name: string;
  repo_owner: string;
}

export interface CreateRepoPayload {
  name: string;
  description?: string;
}

export interface CreateRepoResponse {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  owner: {
    login: string;
  };
}
