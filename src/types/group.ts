// ==================== Enums ====================

export type GroupStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';

export type MembershipRole = 'MEMBER' | 'LEADER' | 'MENTOR';

export interface GroupTopic {
  id: string;
  name: string;
  description?: string;
  is_taken?: boolean;
}

// ==================== Entities ====================

/** A member within a group, includes user info and role */
export interface GroupMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role_in_group: MembershipRole;
  joined_at: string;
}

/** Group summary (returned in list endpoint) */
export interface Group {
  id: string;
  name: string;
  class_id: string;
  topic_id?: string;
  topic?: GroupTopic | null;
  project_name?: string;
  description?: string;
  semester?: string;
  status: GroupStatus;
  github_repo_url?: string;
  jira_project_key?: string;
  members_count: number;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

/** Group detail with members array */
export interface GroupDetail extends Group {
  members: GroupMember[];
}

/** Paginated response from GET /api/groups */
export interface PaginatedGroups {
  data: Group[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

// ==================== Payloads ====================

export interface CreateGroupPayload {
  name: string;
  class_id: string;
  project_name?: string;
  description?: string;
  semester?: string;
  github_repo_url?: string;
  jira_project_key?: string;
}

export interface UpdateGroupPayload {
  name?: string;
  project_name?: string;
  description?: string;
  semester?: string;
  topic_id?: string;
  github_repo_url?: string;
  jira_project_key?: string;
  status?: GroupStatus;
}

export interface QueryGroupsParams {
  page?: number;
  limit?: number;
  semester?: string;
  status?: GroupStatus;
  search?: string;
}

export interface AddMemberPayload {
  user_id: string;
  role_in_group?: MembershipRole;
}
