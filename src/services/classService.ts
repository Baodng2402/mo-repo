import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';
import type { ClassItem, JoinClassPayload, JoinClassResponse } from '../types/class';

/**
 * Get all available classes
 * GET /api/classes
 */
export const getAllClasses = async (): Promise<ClassItem[]> => {
  const response = await axiosClient.get<ClassItem[]>(ENDPOINTS.CLASSES.LIST);
  return response.data;
};

/**
 * Get classes the current student is enrolled in
 * GET /api/classes/my-classes
 */
export const getMyClasses = async (): Promise<ClassItem[]> => {
  const response = await axiosClient.get<ClassItem[]>(ENDPOINTS.CLASSES.MY_CLASSES);
  return response.data;
};

/**
 * Join a class using an enrollment key
 * POST /api/classes/:id/join
 */
export const joinClass = async (
  classId: string,
  payload: JoinClassPayload
): Promise<JoinClassResponse> => {
  const response = await axiosClient.post<JoinClassResponse>(
    ENDPOINTS.CLASSES.JOIN(classId),
    payload
  );
  return response.data;
};
