import React, { useEffect } from "react";
import { Check, Info, X, TriangleAlert } from "lucide-react";

export type NotificationTone = "success" | "info" | "warning" | "error";

export type AppNotification = {
  id: number;
  title: string;
  message?: string;
  tone: NotificationTone;
  duration?: number;
};

type NotificationCenterProps = {
  notifications: AppNotification[];
  onDismiss: (id: number) => void;
};

const icons = {
  success: Check,
  info: Info,
  warning: TriangleAlert,
  error: TriangleAlert,
};

export function NotificationCenter({ notifications, onDismiss }: NotificationCenterProps) {
  return (
    <aside className="notification-center" aria-label="إشعارات المنصة" aria-live="polite">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onDismiss={onDismiss} />
      ))}
    </aside>
  );
}

function NotificationItem({ notification, onDismiss }: { notification: AppNotification; onDismiss: (id: number) => void }) {
  const Icon = icons[notification.tone];

  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(notification.id), notification.duration ?? 5200);
    return () => window.clearTimeout(timeout);
  }, [notification.duration, notification.id, onDismiss]);

  return (
    <div className={`notification-card notification-${notification.tone}`} role="status">
      <span className="notification-icon"><Icon size={17} /></span>
      <div className="notification-copy">
        <strong>{notification.title}</strong>
        {notification.message && <p>{notification.message}</p>}
      </div>
      <button type="button" className="notification-close" onClick={() => onDismiss(notification.id)} aria-label="إغلاق الإشعار">
        <X size={15} />
      </button>
    </div>
  );
}
