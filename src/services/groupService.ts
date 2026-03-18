import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';
import type {
  Group,
  GroupDetail,
  GroupMember,
  PaginatedGroups,
  CreateGroupPayload,
  UpdateGroupPayload,
  QueryGroupsParams,
  AddMemberPayload,
  MembershipRole,
} from '../types/group';
import type { GroupRepo, LinkRepoPayload } from '../types/github';
import type { GitHubCommit } from '../types/github';

// ==================== Group CRUD ====================

/**
 * List groups (students see own, lecturers/admins see all)
 * GET /api/groups
 */
export const getGroups = async (params?: QueryGroupsParams): Promise<PaginatedGroups> => {
  const response = await axiosClient.get<PaginatedGroups>(ENDPOINTS.GROUPS.LIST, {
    params,
  });
  return response.data;
};

/**
 * Get group detail with members
 * GET /api/groups/:id
 */
export const getGroupById = async (id: string): Promise<GroupDetail> => {
  const response = await axiosClient.get<GroupDetail>(ENDPOINTS.GROUPS.DETAIL(id));
  return response.data;
};

/**
 * Create a new group (caller becomes leader)
 * POST /api/groups
 */
export const createGroup = async (payload: CreateGroupPayload): Promise<GroupDetail> => {
  const response = await axiosClient.post<GroupDetail>(ENDPOINTS.GROUPS.CREATE, payload);
  return response.data;
};

/**
 * Update group info (leader or admin only)
 * PATCH /api/groups/:id
 */
export const updateGroup = async (
  id: string,
  payload: UpdateGroupPayload
): Promise<GroupDetail> => {
  const response = await axiosClient.patch<GroupDetail>(ENDPOINTS.GROUPS.UPDATE(id), payload);
  return response.data;
};

/**
 * Delete a group (admin only)
 * DELETE /api/groups/:id
 */
export const deleteGroup = async (id: string): Promise<void> => {
  await axiosClient.delete(ENDPOINTS.GROUPS.DELETE(id));
};

/**
 * Get all groups for a specific class
 * GET /api/groups/class/:classId
 */
export const getGroupsByClass = async (classId: string): Promise<Group[]> => {
  const response = await axiosClient.get<Group[]>(ENDPOINTS.GROUPS.BY_CLASS(classId));
  return response.data;
};

/**
 * Join an empty group (first to join becomes LEADER)
 * POST /api/groups/:id/join
 */
export const joinGroup = async (
  groupId: string
): Promise<{ message: string; role_assigned: string }> => {
  const response = await axiosClient.post<{ message: string; role_assigned: string }>(
    ENDPOINTS.GROUPS.JOIN_GROUP(groupId)
  );
  return response.data;
};

// ==================== Member Management ====================

/**
 * List active members of a group
 * GET /api/groups/:id/members
 */
export const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
  const response = await axiosClient.get<GroupMember[]>(ENDPOINTS.GROUPS.MEMBERS(groupId));
  return response.data;
};

/**
 * Add a member to the group (leader or admin)
 * POST /api/groups/:id/members
 */
export const addMember = async (
  groupId: string,
  payload: AddMemberPayload
): Promise<GroupMember[]> => {
  const response = await axiosClient.post<GroupMember[]>(
    ENDPOINTS.GROUPS.ADD_MEMBER(groupId),
    payload
  );
  return response.data;
};

/**
 * Update member role (leader or admin)
 * PATCH /api/groups/:id/members/:userId
 */
export const updateMemberRole = async (
  groupId: string,
  userId: string,
  role: MembershipRole
): Promise<GroupMember[]> => {
  const response = await axiosClient.patch<GroupMember[]>(
    ENDPOINTS.GROUPS.UPDATE_MEMBER(groupId, userId),
    { role_in_group: role }
  );
  return response.data;
};

/**
 * Remove a member from the group (leader or admin)
 * DELETE /api/groups/:id/members/:userId
 */
export const removeMember = async (groupId: string, userId: string): Promise<void> => {
  await axiosClient.delete(ENDPOINTS.GROUPS.REMOVE_MEMBER(groupId, userId));
};

/**
 * Leave a group voluntarily
 * DELETE /api/groups/:id/members/me
 */
export const leaveGroup = async (groupId: string): Promise<void> => {
  await axiosClient.delete(ENDPOINTS.GROUPS.LEAVE(groupId));
};

// ==================== Repository Management ====================

/**
 * Get all repositories linked to a group
 * GET /api/groups/:id/repos
 */
export const getGroupRepos = async (groupId: string): Promise<GroupRepo[]> => {
  const response = await axiosClient.get<GroupRepo[]>(ENDPOINTS.GROUPS.REPOS(groupId));
  return response.data;
};

/**
 * Get recent commits for a linked group repository.
 * GET /api/groups/:id/repos/:repoId/commits
 */
export const getGroupRepoCommits = async (
  groupId: string,
  repoId: string
): Promise<GitHubCommit[]> => {
  const response = await axiosClient.get<GitHubCommit[]>(
    ENDPOINTS.GROUPS.REPO_COMMITS(groupId, repoId)
  );
  return response.data;
};

/**
 * Link a repository to a group (leader only)
 * POST /api/groups/:id/repos
 */
export const linkRepoToGroup = async (
  groupId: string,
  payload: LinkRepoPayload
): Promise<GroupRepo> => {
  const response = await axiosClient.post<GroupRepo>(ENDPOINTS.GROUPS.REPOS(groupId), payload);
  return response.data;
};
