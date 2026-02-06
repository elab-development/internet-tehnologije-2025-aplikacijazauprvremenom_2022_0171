"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type DispatchItem = {
  id: string;
  message: string;
  remindAt: string;
};

type ApiResponse<T> = {
  data?: T;
  error?: { message?: string };
};

export function ReminderDispatchListener() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function dispatchNow() {
      try {
        const response = await fetch("/api/reminders/dispatch", { method: "POST" });
        const payload = (await response.json()) as ApiResponse<DispatchItem[]>;
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Reminder dispatch failed");
        }

        if (isCancelled || !payload.data || payload.data.length === 0) return;

        payload.data.forEach((entry) => {
          toast.info(`Podsetnik: ${entry.message}`);
          if (permission === "granted" && typeof Notification !== "undefined") {
            new Notification("Podsetnik", { body: entry.message });
          }
        });
      } catch {
        // Keep silent in background listener to avoid noisy toasts on temporary network failures.
      }
    }

    void dispatchNow();
    const interval = setInterval(() => {
      void dispatchNow();
    }, 60000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [permission]);

  return null;
}
