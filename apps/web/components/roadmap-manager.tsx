"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCapturedAt } from "@/lib/roadmap";

type SessionOption = {
  id: string;
  name: string;
  status: string;
  captured_at_local: string | null;
  created_at: string;
};

type Roadmap = {
  id: string;
  name: string;
  description: string | null;
  target_training_count: number | null;
};

type RoadmapSessionItem = {
  session_id: string;
  position: number;
  session: SessionOption | null;
};

type RoadmapManagerProps = {
  sessions: SessionOption[];
  selectedIds: string[];
  roadmaps: Roadmap[];
  activeRoadmap: Roadmap | null;
  activeRoadmapSessions: RoadmapSessionItem[];
};

export function RoadmapManager({
  sessions,
  selectedIds,
  roadmaps,
  activeRoadmap,
  activeRoadmapSessions
}: RoadmapManagerProps) {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [createTarget, setCreateTarget] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [editName, setEditName] = useState(activeRoadmap?.name ?? "");
  const [editTarget, setEditTarget] = useState(activeRoadmap?.target_training_count ? String(activeRoadmap.target_training_count) : "");
  const [editDescription, setEditDescription] = useState(activeRoadmap?.description ?? "");
  const [sessionToAdd, setSessionToAdd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setEditName(activeRoadmap?.name ?? "");
    setEditTarget(activeRoadmap?.target_training_count ? String(activeRoadmap.target_training_count) : "");
    setEditDescription(activeRoadmap?.description ?? "");
  }, [activeRoadmap]);

  const roadmapSessionIds = useMemo(
    () => new Set(activeRoadmapSessions.map((item) => item.session_id)),
    [activeRoadmapSessions]
  );
  const availableSessions = sessions.filter((session) => session.status === "completed" && !roadmapSessionIds.has(session.id));
  const completedCount = activeRoadmapSessions.length;

  function goToRoadmap(roadmapId: string) {
    router.replace(`/compare?roadmap=${roadmapId}`);
  }

  return (
    <section className="surface card">
      <p className="eyebrow">Roadmaps</p>
      <h2 style={{ marginBottom: 12 }}>Bloques guardados de entrenamiento</h2>
      <p className="muted" style={{ marginBottom: 18 }}>
        Guarda comparaciones como roadmap para seguir la evolución de varios entrenamientos, con fechas y cantidad total del bloque.
      </p>
      <div className="grid-2">
        <div className="session-grid">
          <article className="session-card">
            <strong>Crear roadmap desde la selección actual</strong>
            <span className="muted">Sesiones seleccionadas: {selectedIds.length}</span>
            <label className="field">
              <span>Nombre del roadmap</span>
              <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Ej: Bloque salida 30 m - abril" />
            </label>
            <label className="field">
              <span>Cantidad objetivo de entrenamientos</span>
              <input type="number" min="1" max="200" value={createTarget} onChange={(event) => setCreateTarget(event.target.value)} />
            </label>
            <label className="field">
              <span>Descripción</span>
              <textarea rows={4} value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} />
            </label>
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setSuccess(null);
                startTransition(async () => {
                  const response = await fetch("/api/roadmaps", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: createName,
                      description: createDescription,
                      target_training_count: createTarget,
                      session_ids: selectedIds
                    })
                  });
                  const payload = await response.json().catch(() => ({}));
                  if (!response.ok) {
                    setError(payload.error ?? "No pude crear el roadmap");
                    return;
                  }
                  setSuccess("Roadmap creado.");
                  if (payload.roadmap?.id) {
                    router.replace(`/compare?roadmap=${payload.roadmap.id}`);
                    router.refresh();
                  }
                });
              }}
            >
              {pending ? "Guardando..." : "Crear roadmap"}
            </button>
          </article>

          <article className="session-card">
            <strong>Roadmaps existentes</strong>
            {roadmaps.length ? (
              <div className="session-grid">
                {roadmaps.map((roadmap) => {
                  const active = roadmap.id === activeRoadmap?.id;
                  return (
                    <button
                      key={roadmap.id}
                      type="button"
                      className={active ? "button" : "button-secondary"}
                      style={{ justifyContent: "space-between" }}
                      onClick={() => goToRoadmap(roadmap.id)}
                    >
                      <span>{roadmap.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="muted">Aún no hay roadmaps guardados.</span>
            )}
          </article>
        </div>

        <div className="session-grid">
          {activeRoadmap ? (
            <article className="session-card">
              <strong>Editar roadmap activo</strong>
              <span className="muted">
                Entrenamientos en el roadmap: {completedCount}
                {activeRoadmap.target_training_count ? ` / ${activeRoadmap.target_training_count}` : ""}
              </span>
              <label className="field">
                <span>Nombre</span>
                <input value={editName} onChange={(event) => setEditName(event.target.value)} />
              </label>
              <label className="field">
                <span>Cantidad objetivo</span>
                <input type="number" min="1" max="200" value={editTarget} onChange={(event) => setEditTarget(event.target.value)} />
              </label>
              <label className="field">
                <span>Descripción</span>
                <textarea rows={4} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    startTransition(async () => {
                      const response = await fetch(`/api/roadmaps/${activeRoadmap.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: editName,
                          description: editDescription,
                          target_training_count: editTarget
                        })
                      });
                      const payload = await response.json().catch(() => ({}));
                      if (!response.ok) {
                        setError(payload.error ?? "No pude actualizar el roadmap");
                        return;
                      }
                      setSuccess("Roadmap actualizado.");
                      router.refresh();
                    });
                  }}
                >
                  Guardar cambios
                </button>
                <button
                  type="button"
                  className="button-danger"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("Esto eliminará el roadmap y su análisis IA guardado.")) {
                      return;
                    }
                    setError(null);
                    setSuccess(null);
                    startTransition(async () => {
                      const response = await fetch(`/api/roadmaps/${activeRoadmap.id}`, { method: "DELETE" });
                      const payload = await response.json().catch(() => ({}));
                      if (!response.ok) {
                        setError(payload.error ?? "No pude eliminar el roadmap");
                        return;
                      }
                      router.replace("/compare");
                      router.refresh();
                    });
                  }}
                >
                  Eliminar roadmap
                </button>
              </div>
              <label className="field">
                <span>Agregar entrenamiento completado</span>
                <select value={sessionToAdd} onChange={(event) => setSessionToAdd(event.target.value)}>
                  <option value="">Selecciona una sesión</option>
                  {availableSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name} · {formatCapturedAt(session.captured_at_local ?? session.created_at)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button-secondary"
                disabled={pending || !sessionToAdd}
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  startTransition(async () => {
                    const response = await fetch(`/api/roadmaps/${activeRoadmap.id}/sessions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ session_id: sessionToAdd })
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                      setError(payload.error ?? "No pude agregar la sesión al roadmap");
                      return;
                    }
                    setSessionToAdd("");
                    setSuccess("Entrenamiento agregado.");
                    router.refresh();
                  });
                }}
              >
                Agregar al roadmap
              </button>
              <div className="session-grid">
                {activeRoadmapSessions.map((item, index) => (
                  <div key={item.session_id} className="session-card">
                    <div className="session-meta">
                      <strong>
                        #{index + 1} {item.session?.name ?? item.session_id}
                      </strong>
                      <button
                        type="button"
                        className="button-danger"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setSuccess(null);
                          startTransition(async () => {
                            const response = await fetch(
                              `/api/roadmaps/${activeRoadmap.id}/sessions/${item.session_id}`,
                              { method: "DELETE" }
                            );
                            const payload = await response.json().catch(() => ({}));
                            if (!response.ok) {
                              setError(payload.error ?? "No pude quitar la sesión del roadmap");
                              return;
                            }
                            setSuccess("Entrenamiento quitado.");
                            router.refresh();
                          });
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                    <span className="muted">
                      {formatCapturedAt(item.session?.captured_at_local ?? item.session?.created_at ?? null)}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ) : (
            <article className="session-card">
              <strong>Activa un roadmap</strong>
              <span className="muted">
                Al abrir un roadmap podrás agregar o quitar entrenamientos, editar la cantidad objetivo y generar el análisis IA del bloque.
              </span>
            </article>
          )}
        </div>
      </div>
      {error ? <div className="notice notice-error" style={{ marginTop: 16 }}>{error}</div> : null}
      {success ? <div className="notice notice-ok" style={{ marginTop: 16 }}>{success}</div> : null}
    </section>
  );
}
