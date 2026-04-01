// ==================== GitHub Activity Types ====================

/** Status of a Jira task */
export type JiraTaskStatus = 'TO_DO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

/** A single GitHub commit */
export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

/** GitHub contribution stats for a single member */
export interface ContributorStats {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  totalCommits: number;
  additions: number;
  deletions: number;
}

/** A Jira task assigned to a member */
export interface JiraTask {
  id: string;
  key: string;
  summary: string;
  status: JiraTaskStatus;
  assigneeId: string;
  assigneeName: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  updatedAt: string;
}

// ==================== Evaluation Types ====================

/** Score allocation for a single member (set by leader) */
export interface MemberEvaluation {
  userId: string;
  fullName: string;
  percentage: number;
}

/** Jira status display config */
export const JIRA_STATUS_CONFIG: Record<
  JiraTaskStatus,
  { label: string; color: string; bg: string }
> = {
  TO_DO: { label: 'To Do', color: '#94A3B8', bg: '#94A3B8' },
  IN_PROGRESS: { label: 'In Progress', color: '#3B82F6', bg: '#3B82F6' },
  DONE: { label: 'Done', color: '#22C55E', bg: '#22C55E' },
  BLOCKED: { label: 'Blocked', color: '#EF4444', bg: '#EF4444' },
};

/** Jira priority display config */
export const JIRA_PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low', color: '#64748B' },
  MEDIUM: { label: 'Medium', color: '#EAB308' },
  HIGH: { label: 'High', color: '#F97316' },
  CRITICAL: { label: 'Critical', color: '#EF4444' },
};
