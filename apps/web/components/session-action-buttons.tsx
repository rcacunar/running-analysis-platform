"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SessionActionButtonsProps = {
  sessionId: string;
  status: string;
  redirectOnDelete?: string;
};

export function SessionActionButtons({
  sessionId,
  status,
  redirectOnDelete
}: SessionActionButtonsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"reanalyze" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();
  const reanalyzeDisabled = pending || status === "pending" || status === "processing";

  function handleReanalyze() {
    setError(null);
    setPendingAction("reanalyze");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/reanalyze`, { method: "POST" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(payload.error ?? "No pude relanzar el análisis");
          return;
        }
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Esta acción eliminará la sesión y sus resultados. ¿Quieres continuar?")) {
      return;
    }

    setError(null);
    setPendingAction("delete");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(payload.error ?? "No pude eliminar la sesión");
          return;
        }
        if (redirectOnDelete) {
          router.push(redirectOnDelete);
        }
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className="button-secondary"
          disabled={reanalyzeDisabled}
          onClick={handleReanalyze}
        >
          {pendingAction === "reanalyze" ? "Relanzando..." : "Reanalizar"}
        </button>
        <button
          type="button"
          className="button-danger"
          disabled={pending}
          onClick={handleDelete}
        >
          {pendingAction === "delete" ? "Eliminando..." : "Eliminar sesión"}
        </button>
      </div>
      {error ? <div className="notice notice-error">{error}</div> : null}
    </>
  );
}
