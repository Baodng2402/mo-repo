import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Get all notifications for current user.
 * GET /api/notifications
 */
export const getNotifications = async (): Promise<AppNotification[]> => {
  try {
    const response = await axiosClient.get<AppNotification[]>(ENDPOINTS.NOTIFICATIONS.LIST, {
      expectedErrorStatuses: [404],
    } as any);
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Mark a notification as read.
 * PUT /api/notifications/:id/read
 */
export const markNotificationAsRead = async (id: string): Promise<AppNotification> => {
  const response = await axiosClient.put<AppNotification>(ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
  return response.data;
};
