import { beforeApi } from '../api/beforeApi';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  message: string;
  status: 'UNREAD' | 'READ';
  createdAt: string;
}

export const notificationService = {
  async getNotifications(): Promise<NotificationItem[]> {
    try {
      const list = await beforeApi.getNotifications();
      return (list || []).map((n: any) => ({
        id: n.id,
        userId: n.userId,
        type: n.type || 'DISASTER_ALERT',
        message: n.message,
        status: n.status || 'UNREAD',
        createdAt: n.createdAt || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },

  async markAsRead(id: string): Promise<any> {
    return beforeApi.markNotificationRead(id);
  },
};
