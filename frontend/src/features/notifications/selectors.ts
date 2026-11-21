import type { Notification } from "@retrest/shared";

/** Server-confirmed unread notifications (read_at is set by the backend, never the client). */
export const unreadNotifications = <T extends Pick<Notification, "read_at">>(notifications: T[]) =>
  notifications.filter((notification) => !notification.read_at);

export const recentUnreadCount = <T extends Pick<Notification, "read_at">>(notifications: T[]) =>
  unreadNotifications(notifications).length;
