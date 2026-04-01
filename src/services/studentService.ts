import { getGroups } from './groupService';
import type { Group } from '../types/group';

export const getMyGroups = async (): Promise<Group[]> => {
  const firstPage = await getGroups({ page: 1, limit: 50 });
  const groups = [...(firstPage.data || [])];
  const totalPages = firstPage.meta?.total_pages || 1;

  if (totalPages <= 1) {
    return groups;
  }

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await getGroups({ page, limit: 50 });
    groups.push(...(nextPage.data || []));
  }

  return groups;
};

/**
 * Returns the first available group of current student.
 * Backend already filters groups by membership for student role.
 */
export const getMyPrimaryGroup = async (): Promise<Group | null> => {
  const groups = await getMyGroups();
  return groups[0] || null;
};
