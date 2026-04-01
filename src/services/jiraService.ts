import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  siteUrl?: string;
  /** Canonical resource URL, e.g. https://yoursite.atlassian.net/rest/api/3/project/10000 */
  self?: string;
}

export interface LinkJiraProjectPayload {
  github_repo_full_name: string;
  jira_project_id: string;
}

interface JiraProjectsWrappedResponse {
  values?: JiraProject[];
  data?: JiraProject[];
  projects?: JiraProject[];
}

/**
 * Get accessible Jira projects from linked account.
 * GET /api/jira/projects
 */
export const getJiraProjects = async (): Promise<JiraProject[]> => {
  const response = await axiosClient.get<JiraProject[] | JiraProjectsWrappedResponse>(
    ENDPOINTS.JIRA.PROJECTS,
    {
      expectedErrorStatuses: [400],
    } as any
  );

  const payload = response.data;
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload?.values || payload?.data || payload?.projects || [];
};

/**
 * Check if the current user has access to a Jira project.
 * GET /api/jira/projects/:projectKey/access
 */
export const checkJiraProjectAccess = async (projectKey: string): Promise<boolean> => {
  try {
    const response = await axiosClient.get<{ has_access: boolean }>(
      ENDPOINTS.JIRA.PROJECT_ACCESS(projectKey),
      { expectedErrorStatuses: [400, 401, 403, 404] } as any
    );
    return response.data?.has_access === true;
  } catch {
    return false;
  }
};

/**
 * Check if the current user can be assigned Jira issues in a project.
 * GET /api/jira/projects/:projectKey/assignable
 */
export const checkJiraProjectAssignable = async (projectKey: string): Promise<boolean> => {
  try {
    const response = await axiosClient.get<{ assignable: boolean }>(
      ENDPOINTS.JIRA.PROJECT_ASSIGNABLE(projectKey),
      { expectedErrorStatuses: [400, 401, 403, 404] } as any
    );
    return response.data?.assignable === true;
  } catch {
    return false;
  }
};

/**
 * Link a GitHub repository to a Jira project.
 * POST /api/jira/projects/link
 */
export const linkJiraProject = async (
  payload: LinkJiraProjectPayload
): Promise<{ id?: string; github_repo_full_name: string; jira_project_id: string }> => {
  const response = await axiosClient.post(ENDPOINTS.JIRA.LINK_PROJECT, payload, {
    expectedErrorStatuses: [400],
  } as any);
  return response.data;
};
