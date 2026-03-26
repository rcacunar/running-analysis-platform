import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fmt, statusLabel } from "@/lib/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SessionActionButtons } from "@/components/session-action-buttons";
import { SessionAIReport } from "@/components/session-ai-report";
import { SessionContextForm } from "@/components/session-context-form";
import { SessionStatusWatcher } from "@/components/session-status-watcher";
import { SessionVisuals } from "@/components/session-visuals";
import { isSessionAIEnabled } from "@/lib/session-ai";

const EXPORT_META: Record<string, { label: string; description: string }> = {
  summary: { label: "Resumen CSV", description: "Métricas globales de la sesión" },
  sprints: { label: "Piques CSV", description: "Tramos rápidos detectados" },
  phases: { label: "Fases CSV", description: "Partida, aceleración, meseta y bajada" },
  bouts: { label: "Bloques CSV", description: "Bloques principales de esfuerzo" },
  features: { label: "Series derivadas CSV", description: "Series temporales listas para análisis" },
  playback_track: { label: "Ruta + esfuerzo CSV", description: "Track sincronizado para reproducción" },
  location_clean: { label: "GPS limpio CSV", description: "Trayectoria GPS filtrada y corregida" }
};

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const admin = createSupabaseAdminClient();
  const aiEnabled = isSessionAIEnabled();

  const [{ data: session }, { data: summary }, { data: sprints }, { data: phases }, { data: playback }, { data: features }, { data: exports }, { data: aiReport }] =
    await Promise.all([
      supabase.from("sessions").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("session_summaries").select("*").eq("session_id", id).maybeSingle(),
      supabase.from("session_sprints").select("*").eq("session_id", id).order("t_start_s"),
      supabase.from("session_phases").select("*").eq("session_id", id).order("t_start_s"),
      supabase.from("session_playback_points").select("*").eq("session_id", id).order("t_center"),
      supabase.from("session_feature_points").select("*").eq("session_id", id).order("t_center"),
      supabase.from("session_exports").select("*").eq("session_id", id).order("kind"),
      supabase.from("session_ai_reports").select("*").eq("session_id", id).maybeSingle()
    ]);

  if (!session) {
    notFound();
  }

  const exportLinks = await Promise.all(
    ((exports ?? []) as any[]).map(async (asset) => {
      const { data } = await admin.storage.from(asset.bucket).createSignedUrl(asset.storage_path, 3600);
      const meta = EXPORT_META[asset.kind] ?? {
        label: asset.kind,
        description: "Archivo exportado por el pipeline de análisis"
      };
      return {
        ...asset,
        url: data?.signedUrl ?? null,
        ...meta
      };
    })
  );

  return (
    <>
      <section className="surface card">
        <SessionStatusWatcher sessionId={session.id} status={session.status} />
        <div className="session-meta">
          <div>
            <p className="eyebrow">Detalle</p>
            <h2>{session.name}</h2>
            <div className="muted">{session.raw_zip_name ?? "ZIP sin nombre"}</div>
          </div>
          <span className={`status-pill status-${session.status}`}>{statusLabel(session.status)}</span>
        </div>
        <div className="metric-grid" style={{ marginTop: 18 }}>
          <article className="metric-card">
            <span>Velocidad pico</span>
            <strong>{fmt(summary?.peak_speed_kmh)} km/h</strong>
          </article>
          <article className="metric-card">
            <span>Acel. pico de partida</span>
            <strong>{fmt(summary?.best_sprint_launch_peak_accel_mps2)} m/s2</strong>
          </article>
          <article className="metric-card">
            <span>Tiempo a 50%</span>
            <strong>{fmt(summary?.best_sprint_time_to_50pct_peak_s)} s</strong>
          </article>
          <article className="metric-card">
            <span>Tiempo a 90%</span>
            <strong>{fmt(summary?.best_sprint_time_to_90pct_peak_s)} s</strong>
          </article>
        </div>
        <div className="metric-grid" style={{ marginTop: 18 }}>
          <article className="metric-card">
            <span>Actividad detectada</span>
            <strong>{summary?.detected_activity ?? "n/d"}</strong>
          </article>
          <article className="metric-card">
            <span>Actividad dominante</span>
            <strong>{summary?.dominant_activity ?? "n/d"}</strong>
          </article>
          <article className="metric-card">
            <span>Actividad esperada</span>
            <strong>{session.intended_activity ?? "auto"}</strong>
          </article>
          <article className="metric-card">
            <span>Carga adicional</span>
            <strong>{session.added_load_kg == null ? "0 kg" : `${fmt(session.added_load_kg)} kg`}</strong>
          </article>
          <article className="metric-card">
            <span>Mejor 3s</span>
            <strong>{fmt(summary?.best_3s_speed_kmh)} km/h</strong>
          </article>
          <article className="metric-card">
            <span>Mejor 5s</span>
            <strong>{fmt(summary?.best_5s_speed_kmh)} km/h</strong>
          </article>
          <article className="metric-card">
            <span>Vel. media en movimiento</span>
            <strong>{fmt(summary?.moving_avg_speed_kmh)} km/h</strong>
          </article>
          <article className="metric-card">
            <span>Tiempo en movimiento</span>
            <strong>{fmt(summary?.moving_time_s)} s</strong>
          </article>
          <article className="metric-card">
            <span>Cadencia pico</span>
            <strong>{fmt(summary?.peak_cadence_spm)} spm</strong>
          </article>
          <article className="metric-card">
            <span>Impacto pico</span>
            <strong>{fmt(summary?.peak_impact_mps2)} m/s2</strong>
          </article>
          <article className="metric-card">
            <span>Jerk pico</span>
            <strong>{fmt(summary?.peak_jerk_mps3)} m/s3</strong>
          </article>
          <article className="metric-card">
            <span>Calidad GPS</span>
            <strong>{fmt(summary?.gps_quality_pct)} %</strong>
          </article>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <Link href={`/compare?ids=${session.id}`} className="button-secondary">
            Comparar esta sesión
          </Link>
          <SessionActionButtons sessionId={session.id} status={session.status} redirectOnDelete="/sessions" />
        </div>
        <div className="export-grid" style={{ marginTop: 18 }}>
          {exportLinks.map((asset) => (
            <article key={asset.id} className="export-card">
              <strong>{asset.label}</strong>
              <span className="muted">{asset.description}</span>
              {asset.url ? (
                <a href={asset.url} className="button-secondary" target="_blank" rel="noreferrer">
                  Descargar
                </a>
              ) : (
                <span className="muted">Sin enlace disponible</span>
              )}
            </article>
          ))}
        </div>
      </section>

      {session.status === "completed" ? (
        <>
          <SessionContextForm session={session as any} />
          <SessionAIReport
            sessionId={session.id}
            aiEnabled={aiEnabled}
            initialReportText={aiReport?.report_text ?? null}
            initialModel={aiReport?.model ?? null}
          />
          <SessionVisuals
            features={(features ?? []) as any[]}
            playback={(playback ?? []) as any[]}
            phases={(phases ?? []) as any[]}
            sprints={(sprints ?? []) as any[]}
          />
          <div className="grid-2">
            <section className="surface card">
              <p className="eyebrow">Piques</p>
              <h2 style={{ marginBottom: 18 }}>Tramos rápidos detectados</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Vmax</th>
                      <th>Apartida</th>
                      <th>T90</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sprints ?? []).map((row: any) => (
                      <tr key={row.id}>
                        <td>{row.sprint_id}</td>
                        <td>{fmt(row.t_start_s)} s</td>
                        <td>{fmt(row.t_end_s)} s</td>
                        <td>{fmt(row.peak_speed_kmh)} km/h</td>
                        <td>{fmt(row.launch_peak_accel_mps2)} m/s2</td>
                        <td>{fmt(row.time_to_90pct_peak_s)} s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="surface card">
              <p className="eyebrow">Fases</p>
              <h2 style={{ marginBottom: 18 }}>Segmentación por bloque</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bloque</th>
                      <th>Fase</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Duración</th>
                      <th>Vmed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(phases ?? []).map((row: any) => (
                      <tr key={row.id}>
                        <td>{row.bout_id}</td>
                        <td>{row.phase}</td>
                        <td>{fmt(row.t_start_s)} s</td>
                        <td>{fmt(row.t_end_s)} s</td>
                        <td>{fmt(row.duration_s)} s</td>
                        <td>{fmt(row.mean_speed_kmh)} km/h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : (
        <section className="surface card">
          <SessionStatusWatcher sessionId={session.id} status={session.status} />
          <p className="eyebrow">Estado</p>
          <h2>Aún no hay resultados finales</h2>
          <p className="muted">
            Esta sesión está en estado <strong>{statusLabel(session.status)}</strong>. Recarga la página en unos segundos.
          </p>
          {session.error_message ? <div className="notice notice-error">{session.error_message}</div> : null}
        </section>
      )}
    </>
  );
}
