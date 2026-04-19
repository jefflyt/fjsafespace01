"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  compact?: boolean;
}

export function NotificationBell({ compact = false }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function fetchNotifications() {
    try {
      const data = await api.get<Notification[]>("/api/notifications");
      setNotifications(data);
    } catch {
      // Silent fail — notifications are non-critical
    }
  }

  async function markRead(id: string) {
    try {
      await api.patch(`/api/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // Silent fail
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) fetchNotifications(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={`h-5 w-5 ${unreadCount > 0 ? "animate-pulse" : ""}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {notifications.length === 0 ? (
          <DropdownMenuItem disabled className="justify-center text-muted-foreground">
            No notifications
          </DropdownMenuItem>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={`flex flex-col items-start gap-1 py-3 cursor-default ${n.read ? "opacity-60" : "font-medium"}`}
              onClick={() => markRead(n.id)}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm">{n.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
