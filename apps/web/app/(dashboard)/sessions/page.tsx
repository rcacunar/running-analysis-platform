import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fmt, statusLabel } from "@/lib/format";
import { SessionUploadForm } from "@/components/session-upload-form";
import type { SessionRow, SummaryRow } from "@/lib/types";

export default async function SessionsPage() {
  const { supabase, user } = await requireUser();

  const [{ data: sessions }, { data: summaries }] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("session_summaries").select("*")
  ]);

  const summaryBySession = new Map<string, SummaryRow>(
    (summaries ?? []).map((row) => [row.session_id, row as SummaryRow])
  );

  return (
    <>
      <section className="surface card">
        <p className="eyebrow">Nueva sesión</p>
        <h2 style={{ marginBottom: 18 }}>Sube un ZIP y dispara el análisis</h2>
        <SessionUploadForm />
      </section>

      <section className="surface card">
        <p className="eyebrow">Historial</p>
        <h2 style={{ marginBottom: 18 }}>Tus sesiones analizadas</h2>
        <div className="session-grid">
          {(sessions as SessionRow[] | null)?.map((session) => {
            const summary = summaryBySession.get(session.id);
            return (
              <article key={session.id} className="session-card">
                <div className="session-meta">
                  <div>
                    <strong>{session.name}</strong>
                    <div className="muted">{session.raw_zip_name ?? "ZIP sin nombre"}</div>
                  </div>
                  <span className={`status-pill status-${session.status}`}>{statusLabel(session.status)}</span>
                </div>
                <div className="grid-3">
                  <div>
                    <div className="muted">Velocidad pico</div>
                    <strong>{fmt(summary?.peak_speed_kmh)} km/h</strong>
                  </div>
                  <div>
                    <div className="muted">Acel. partida</div>
                    <strong>{fmt(summary?.best_sprint_launch_peak_accel_mps2)} m/s2</strong>
                  </div>
                  <div>
                    <div className="muted">Tiempo a 90%</div>
                    <strong>{fmt(summary?.best_sprint_time_to_90pct_peak_s)} s</strong>
                  </div>
                </div>
                {session.error_message ? <div className="notice notice-error">{session.error_message}</div> : null}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link href={`/sessions/${session.id}`} className="button">
                    Ver detalle
                  </Link>
                  <Link href={`/compare?ids=${session.id}`} className="button-secondary">
                    Comparar
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
