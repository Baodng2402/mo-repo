import { getGroups } from './groupService';
import { getAssignmentReport, type AssignmentItem } from './reportService';
import type { Group } from '../types/group';

/**
 * Returns the first available group of current student.
 * Backend already filters groups by membership for student role.
 */
export const getMyPrimaryGroup = async (): Promise<Group | null> => {
  const res = await getGroups({ page: 1, limit: 20 });
  return res.data[0] || null;
};

/**
 * Returns assignment list for current student's primary group.
 */
export const getMyAssignmentFeed = async (): Promise<{
  group: Group | null;
  assignments: AssignmentItem[];
}> => {
  const group = await getMyPrimaryGroup();

  if (!group) {
    return { group: null, assignments: [] };
  }

  const report = await getAssignmentReport(group.id);
  return {
    group,
    assignments: report.assignments || [],
  };
};
