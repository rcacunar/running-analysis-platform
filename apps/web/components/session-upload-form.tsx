"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SessionUploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const response = await fetch("/api/upload", { method: "POST", body: formData });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            setError(payload.error ?? "No pude subir la sesión");
            return;
          }
          formRef.current?.reset();
          router.push(`/sessions/${payload.sessionId}`);
          router.refresh();
        });
      }}
    >
      <div className="upload-box">
        <label className="field">
          <span>Nombre visible</span>
          <input name="name" type="text" placeholder="Pique 30m - martes AM" />
        </label>
        <label className="field">
          <span>Actividad esperada</span>
          <select name="intended_activity" defaultValue="">
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
          <input name="added_load_kg" type="number" min="0" step="0.1" placeholder="Ej: 40" />
        </label>
        <label className="field">
          <span>Notas de la sesión</span>
          <textarea
            name="session_notes"
            rows={3}
            placeholder="Ej: trote con 40 kg, bolsillo derecho, terreno plano, sesión de resistencia"
          />
        </label>
        <label className="field">
          <span>ZIP exportado por Sensor Logger</span>
          <input name="file" type="file" accept=".zip,application/zip" required />
        </label>
      </div>
      {error ? <div className="notice notice-error">{error}</div> : null}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Subiendo..." : "Subir y analizar"}
        </button>
        <span className="muted">El análisis corre en background y la sesión queda guardada en tu cuenta.</span>
      </div>
    </form>
  );
}
