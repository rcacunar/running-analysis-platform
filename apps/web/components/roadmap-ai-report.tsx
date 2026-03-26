"use client";

import { useState, useTransition } from "react";

type RoadmapAIReportProps = {
  roadmapId: string;
  aiEnabled: boolean;
  initialReportText: string | null;
  initialModel: string | null;
};

export function RoadmapAIReport({
  roadmapId,
  aiEnabled,
  initialReportText,
  initialModel
}: RoadmapAIReportProps) {
  const [reportText, setReportText] = useState(initialReportText);
  const [model, setModel] = useState(initialModel);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/roadmaps/${roadmapId}/ai-report`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "No pude generar el análisis IA del roadmap");
        return;
      }
      setReportText(payload.report_text ?? null);
      setModel(payload.model ?? null);
    });
  }

  return (
    <section className="surface card">
      <p className="eyebrow">Roadmap IA</p>
      <h2 style={{ marginBottom: 12 }}>Lectura del bloque de entrenamiento</h2>
      {aiEnabled ? (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <button type="button" className="button-secondary" disabled={pending} onClick={generate}>
              {pending ? (reportText ? "Regenerando..." : "Generando...") : reportText ? "Regenerar análisis del roadmap" : "Generar análisis del roadmap"}
            </button>
            {model ? <span className="muted">Modelo: {model}</span> : null}
          </div>
          {error ? <div className="notice notice-error">{error}</div> : null}
          {reportText ? (
            <div className="ai-report-block">
              <pre>{reportText}</pre>
            </div>
          ) : (
            <p className="muted">
              Genera una lectura del bloque completo para ver progreso, estancamientos y foco del siguiente tramo.
            </p>
          )}
        </>
      ) : (
        <p className="muted">El análisis IA del roadmap está desactivado. Configura `OPENAI_API_KEY` para habilitarlo.</p>
      )}
    </section>
  );
}
