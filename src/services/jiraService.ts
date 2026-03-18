import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface LinkJiraProjectPayload {
  github_repo_full_name: string;
  jira_project_id: string;
}

/**
 * Get accessible Jira projects from linked account.
 * GET /api/jira/projects
 */
export const getJiraProjects = async (): Promise<JiraProject[]> => {
  const response = await axiosClient.get<JiraProject[]>(ENDPOINTS.JIRA.PROJECTS);
  return response.data;
};

/**
 * Link a GitHub repository to a Jira project.
 * POST /api/jira/projects/link
 */
export const linkJiraProject = async (
  payload: LinkJiraProjectPayload
): Promise<{ id?: string; github_repo_full_name: string; jira_project_id: string }> => {
  const response = await axiosClient.post(ENDPOINTS.JIRA.LINK_PROJECT, payload);
  return response.data;
};
