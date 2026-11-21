import type { Dashboard, Notification } from "../../lib/types";
import { requestJson } from "../shared/api.ts";

export const loadNotifications = (signal?: AbortSignal) => requestJson<Dashboard>("/api/state", { signal });
export const recentUnreadCount = (notifications: Notification[]) => notifications.filter(notification => !notification.read_at).length;

// The actual feed is the latest 30 rows, polled by the current shell every 3 seconds.
export const notificationCapabilities = { markRead: false, completeUnreadCount: false, pollingIntervalMs: 3000 } as const;
