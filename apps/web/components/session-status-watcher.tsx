"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type SessionStatusWatcherProps = {
  sessionId: string;
  status: string;
};

export function SessionStatusWatcher({ sessionId, status }: SessionStatusWatcherProps) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "pending" && status !== "processing") {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || cancelled) {
          return;
        }
        if (payload.status !== status || payload.status === "completed" || payload.status === "failed") {
          router.refresh();
        }
      } catch {
        // Ignore transient polling failures.
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router, sessionId, status]);

  if (status !== "pending" && status !== "processing") {
    return null;
  }

  return <p className="muted">Actualización automática activa. Esta vista se recargará cuando termine el análisis.</p>;
}
