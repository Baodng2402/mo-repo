import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';
import { getGroupById, getGroupRepos, getGroupRepoCommits } from './groupService';
import { getCommits } from './githubService';

export interface AssignmentItem {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  type: string;
}

export interface AssignmentReport {
  groupName: string;
  totalTasks: number;
  assignments: AssignmentItem[];
}

export interface SrsReport {
  markdown: string;
}

export interface CommitContributor {
  author: string;
  developer_id: number;
  avatar_url?: string;
  commits: number;
  lines_added: number;
  lines_deleted: number;
  net_change: number;
}

export interface CommitRepositoryReport {
  repository: string;
  contributors: CommitContributor[];
}

export interface CommitReport {
  groupName: string;
  repositories: CommitRepositoryReport[];
}

const mapCommitsToContributors = (authors: string[]): CommitContributor[] => {
  const counter = new Map<string, number>();

  for (const author of authors) {
    const key = author?.trim() || 'Unknown';
    counter.set(key, (counter.get(key) || 0) + 1);
  }

  return Array.from(counter.entries())
    .map(([author, commits]) => ({
      author,
      developer_id: 0,
      commits,
      lines_added: 0,
      lines_deleted: 0,
      net_change: 0,
    }))
    .sort((a, b) => b.commits - a.commits);
};

const parseGithubOwnerRepo = (
  githubUrl?: string
): { owner: string; repo: string } | null => {
  if (!githubUrl) return null;

  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/i, ''),
  };
};

/**
 * Generate AI SRS markdown for a group.
 * POST /api/reports/srs/:groupId
 */
export const generateSrsReport = async (groupId: string): Promise<SrsReport> => {
  const response = await axiosClient.post<SrsReport>(ENDPOINTS.REPORTS.SRS(groupId));
  return response.data;
};

/**
 * Get Jira assignment report for a group.
 * GET /api/reports/assignments/:groupId
 */
export const getAssignmentReport = async (groupId: string): Promise<AssignmentReport> => {
  const response = await axiosClient.get<AssignmentReport>(ENDPOINTS.REPORTS.ASSIGNMENTS(groupId));
  return response.data;
};

/**
 * Get GitHub commit contribution report for a group.
 * GET /api/reports/commits/:groupId
 */
export const getCommitReport = async (groupId: string): Promise<CommitReport> => {
  try {
    const response = await axiosClient.get<CommitReport>(ENDPOINTS.REPORTS.COMMITS(groupId));
    return response.data;
  } catch (error: any) {
    const statusCode = error?.response?.status;
    if (statusCode && statusCode !== 400) {
      throw error;
    }

    // Fallback for environments where commit report generation is not ready
    // or temporarily fails due integration token issues.
    const [group, repos] = await Promise.all([
      getGroupById(groupId),
      getGroupRepos(groupId),
    ]);

    const repoReports: CommitRepositoryReport[] = [];

    for (const repo of repos) {
      try {
        const commits = await getGroupRepoCommits(groupId, repo.id);
        const contributors = mapCommitsToContributors(commits.map((c) => c.author));
        repoReports.push({
          repository: `${repo.repo_owner}/${repo.repo_name}`,
          contributors,
        });
      } catch {
        // Skip repo if commit timeline is unavailable.
      }
    }

    // Some groups only store github_repo_url and don't yet have rows in group_repositories.
    // Fallback to direct GitHub commits API in that case.
    if (repoReports.length === 0) {
      const parsed = parseGithubOwnerRepo(group.github_repo_url);
      if (parsed) {
        try {
          const commits = await getCommits(parsed.owner, parsed.repo);
          const contributors = mapCommitsToContributors(commits.map((c) => c.author));
          repoReports.push({
            repository: `${parsed.owner}/${parsed.repo}`,
            contributors,
          });
        } catch {
          // Keep original behavior if direct API is unavailable.
        }
      }
    }

    if (repoReports.length === 0) {
      throw error;
    }

    return {
      groupName: group.name,
      repositories: repoReports,
    };
  }
};
