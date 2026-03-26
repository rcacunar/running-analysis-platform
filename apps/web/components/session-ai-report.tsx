"use client";

import { useState, useTransition } from "react";

type SessionAIReportProps = {
  sessionId: string;
  aiEnabled: boolean;
  initialReportText: string | null;
  initialModel: string | null;
};

export function SessionAIReport({
  sessionId,
  aiEnabled,
  initialReportText,
  initialModel
}: SessionAIReportProps) {
  const [reportText, setReportText] = useState(initialReportText);
  const [model, setModel] = useState(initialModel);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/sessions/${sessionId}/ai-report`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "No pude generar el análisis IA");
        return;
      }
      setReportText(payload.report_text ?? null);
      setModel(payload.model ?? null);
    });
  }

  return (
    <section className="surface card">
      <p className="eyebrow">Análisis IA</p>
      <h2 style={{ marginBottom: 12 }}>Lectura interpretativa de la sesión</h2>
      {aiEnabled ? (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <button type="button" className="button-secondary" disabled={pending} onClick={generate}>
              {pending ? "Generando..." : reportText ? "Regenerar análisis IA" : "Generar análisis IA"}
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
              Genera un informe en lenguaje natural con contexto técnico, fortalezas, cautelas de medición y foco de mejora.
            </p>
          )}
        </>
      ) : (
        <p className="muted">
          El análisis IA está desactivado. Configura `OPENAI_API_KEY` y, si quieres, `OPENAI_MODEL` para habilitarlo.
        </p>
      )}
    </section>
  );
}
