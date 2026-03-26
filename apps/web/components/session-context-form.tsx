"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionRow } from "@/lib/types";

type SessionContextFormProps = {
  session: SessionRow;
};

export function SessionContextForm({ session }: SessionContextFormProps) {
  const router = useRouter();
  const [intendedActivity, setIntendedActivity] = useState(session.intended_activity ?? "");
  const [addedLoadKg, setAddedLoadKg] = useState(session.added_load_kg == null ? "" : String(session.added_load_kg));
  const [sessionNotes, setSessionNotes] = useState(session.session_notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="surface card">
      <p className="eyebrow">Contexto de la sesión</p>
      <h2 style={{ marginBottom: 12 }}>Actividad y factores extra</h2>
      <p className="muted" style={{ marginBottom: 18 }}>
        Usa esto para aclarar qué tipo de ejercicio fue realmente y si hubo carga adicional, como trote con peso.
      </p>
      <div className="grid-2">
        <label className="field">
          <span>Actividad esperada</span>
          <select value={intendedActivity} onChange={(event) => setIntendedActivity(event.target.value)}>
            <option value="">Detectar automáticamente</option>
            <option value="caminata_intensa">Caminata intensa</option>
            <option value="trote">Trote</option>
            <option value="corrida">Corrida</option>
            <option value="pique">Pique / sprint</option>
            <option value="mixto">Mixto</option>
          </select>
        </label>
        <label className="field">
          <span>Carga adicional (kg)</span>
          <input type="number" min="0" step="0.1" value={addedLoadKg} onChange={(event) => setAddedLoadKg(event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Notas de la sesión</span>
        <textarea rows={4} value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} />
      </label>
      {error ? <div className="notice notice-error">{error}</div> : null}
      {success ? <div className="notice notice-ok">{success}</div> : null}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="button-secondary"
          disabled={pending}
          onClick={() => {
            setError(null);
            setSuccess(null);
            startTransition(async () => {
              const response = await fetch(`/api/sessions/${session.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  intended_activity: intendedActivity,
                  added_load_kg: addedLoadKg,
                  session_notes: sessionNotes
                })
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) {
                setError(payload.error ?? "No pude guardar el contexto de la sesión");
                return;
              }
              setSuccess("Contexto guardado. Regenera el análisis IA si quieres que lo use inmediatamente.");
              router.refresh();
            });
          }}
        >
          {pending ? "Guardando..." : "Guardar contexto"}
        </button>
      </div>
    </section>
  );
}
