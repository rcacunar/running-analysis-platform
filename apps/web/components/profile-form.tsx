"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { estimateBmi } from "@/lib/profile";
import type { ProfileRow } from "@/lib/types";

type ProfileFormProps = {
  profile: ProfileRow | null;
};

type ProfileDraft = {
  full_name: string;
  age_years: string;
  sex: string;
  weight_kg: string;
  height_cm: string;
  resting_heart_rate_bpm: string;
  max_heart_rate_bpm: string;
  training_level: string;
  primary_goal: string;
  notes: string;
};

function valueOf(input: number | string | null | undefined) {
  return input == null ? "" : String(input);
}

function toDraft(profile: ProfileRow | null): ProfileDraft {
  return {
    full_name: profile?.full_name ?? "",
    age_years: valueOf(profile?.age_years),
    sex: profile?.sex ?? "",
    weight_kg: valueOf(profile?.weight_kg),
    height_cm: valueOf(profile?.height_cm),
    resting_heart_rate_bpm: valueOf(profile?.resting_heart_rate_bpm),
    max_heart_rate_bpm: valueOf(profile?.max_heart_rate_bpm),
    training_level: profile?.training_level ?? "",
    primary_goal: profile?.primary_goal ?? "",
    notes: profile?.notes ?? ""
  };
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(profile));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bmi = useMemo(() => estimateBmi(Number(draft.weight_kg) || null, Number(draft.height_cm) || null), [draft]);
  const profileReady = Boolean(draft.age_years && draft.weight_kg && draft.height_cm && draft.training_level);

  function updateField<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid-2">
      <section className="surface card">
        <p className="eyebrow">Perfil</p>
        <h2 style={{ marginBottom: 12 }}>Datos del participante</h2>
        <p className="muted" style={{ marginBottom: 18 }}>
          Este contexto se usa para interpretar mejor la sesión y adaptar el análisis IA al corredor.
        </p>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setSuccess(null);
            startTransition(async () => {
              const response = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft)
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) {
                setError(payload.error ?? "No pude guardar el perfil");
                return;
              }
              setSuccess("Perfil guardado. Los próximos análisis IA usarán este contexto.");
              router.refresh();
            });
          }}
        >
          <div className="grid-2">
            <label className="field">
              <span>Nombre visible</span>
              <input value={draft.full_name} onChange={(event) => updateField("full_name", event.target.value)} />
            </label>
            <label className="field">
              <span>Edad</span>
              <input
                type="number"
                min="10"
                max="100"
                value={draft.age_years}
                onChange={(event) => updateField("age_years", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Sexo</span>
              <select value={draft.sex} onChange={(event) => updateField("sex", event.target.value)}>
                <option value="">No especificado</option>
                <option value="male">Hombre</option>
                <option value="female">Mujer</option>
                <option value="other">Otro</option>
                <option value="prefer_not_to_say">Prefiero no decirlo</option>
              </select>
            </label>
            <label className="field">
              <span>Nivel de entrenamiento</span>
              <select value={draft.training_level} onChange={(event) => updateField("training_level", event.target.value)}>
                <option value="">No especificado</option>
                <option value="principiante">Principiante</option>
                <option value="recreativo">Recreativo</option>
                <option value="entrenado">Entrenado</option>
                <option value="competitivo">Competitivo</option>
              </select>
            </label>
            <label className="field">
              <span>Peso (kg)</span>
              <input
                type="number"
                min="20"
                max="300"
                step="0.1"
                value={draft.weight_kg}
                onChange={(event) => updateField("weight_kg", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Altura (cm)</span>
              <input
                type="number"
                min="100"
                max="260"
                step="0.1"
                value={draft.height_cm}
                onChange={(event) => updateField("height_cm", event.target.value)}
              />
            </label>
            <label className="field">
              <span>FC reposo (bpm)</span>
              <input
                type="number"
                min="25"
                max="220"
                value={draft.resting_heart_rate_bpm}
                onChange={(event) => updateField("resting_heart_rate_bpm", event.target.value)}
              />
            </label>
            <label className="field">
              <span>FC máxima conocida (bpm)</span>
              <input
                type="number"
                min="60"
                max="260"
                value={draft.max_heart_rate_bpm}
                onChange={(event) => updateField("max_heart_rate_bpm", event.target.value)}
              />
            </label>
          </div>
          <label className="field">
            <span>Objetivo principal</span>
            <input
              placeholder="Ej: mejorar salida, bajar tiempo en 30 m, sostener mejor la velocidad"
              value={draft.primary_goal}
              onChange={(event) => updateField("primary_goal", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Notas útiles</span>
            <textarea
              rows={5}
              placeholder="Ej: juega fútbol, entrena 3 veces por semana, llevaba el celular en bolsillo derecho"
              value={draft.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </label>
          {error ? <div className="notice notice-error">{error}</div> : null}
          {success ? <div className="notice notice-ok">{success}</div> : null}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="button" disabled={pending}>
              {pending ? "Guardando..." : "Guardar perfil"}
            </button>
            <span className="muted">No se usa para diagnóstico médico. Sirve para dar mejor contexto deportivo.</span>
          </div>
        </form>
      </section>

      <section className="surface card">
        <p className="eyebrow">Contexto</p>
        <h2 style={{ marginBottom: 12 }}>Cómo se usará en el análisis</h2>
        <div className="metric-grid" style={{ marginBottom: 18 }}>
          <article className="metric-card">
            <span>Perfil base</span>
            <strong>{profileReady ? "Completo" : "Parcial"}</strong>
          </article>
          <article className="metric-card">
            <span>IMC estimado</span>
            <strong>{bmi ? bmi.toFixed(1) : "n/d"}</strong>
          </article>
          <article className="metric-card">
            <span>Objetivo cargado</span>
            <strong>{draft.primary_goal ? "Sí" : "No"}</strong>
          </article>
          <article className="metric-card">
            <span>Contexto cardíaco</span>
            <strong>{draft.resting_heart_rate_bpm || draft.max_heart_rate_bpm ? "Sí" : "No"}</strong>
          </article>
        </div>
        <div className="profile-summary">
          <p>
            La IA usará edad, tamaño corporal, nivel de entrenamiento y objetivo para explicar mejor si un pique fue
            fuerte para tu contexto, no solo en números absolutos.
          </p>
          <p>
            Si completas peso y altura, el informe puede interpretar mejor demanda mecánica e impacto. Si además cargas
            experiencia y objetivo, las recomendaciones salen más ajustadas al tipo de corredor.
          </p>
          <p className="muted">
            Consejo práctico: al menos completa edad, peso, altura y nivel de entrenamiento antes de regenerar un análisis IA.
          </p>
        </div>
      </section>
    </div>
  );
}
