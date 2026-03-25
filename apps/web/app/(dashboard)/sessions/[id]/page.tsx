import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fmt, statusLabel } from "@/lib/format";
import { SessionVisuals } from "@/components/session-visuals";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const [{ data: session }, { data: summary }, { data: sprints }, { data: phases }, { data: playback }, { data: features }, { data: exports }] =
    await Promise.all([
      supabase.from("sessions").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("session_summaries").select("*").eq("session_id", id).maybeSingle(),
      supabase.from("session_sprints").select("*").eq("session_id", id).order("t_start_s"),
      supabase.from("session_phases").select("*").eq("session_id", id).order("t_start_s"),
      supabase.from("session_playback_points").select("*").eq("session_id", id).order("t_center"),
      supabase.from("session_feature_points").select("*").eq("session_id", id).order("t_center"),
      supabase.from("session_exports").select("*").eq("session_id", id).order("kind")
    ]);

  if (!session) {
    notFound();
  }

  return (
    <>
      <section className="surface card">
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
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <Link href={`/compare?ids=${session.id}`} className="button-secondary">
            Comparar esta sesión
          </Link>
          {(exports ?? []).map((asset) => (
            <span key={asset.id} className="muted">
              {asset.kind}
            </span>
          ))}
        </div>
      </section>

      {session.status === "completed" ? (
        <>
          <SessionVisuals
            features={(features ?? []) as any[]}
            playback={(playback ?? []) as any[]}
            phases={(phases ?? []) as any[]}
            sprints={(sprints ?? []) as any[]}
          />
          <div className="grid-2">
            <section className="surface card">
              <p className="eyebrow">Sprints</p>
              <h2 style={{ marginBottom: 18 }}>Tramos detectados</h2>
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
              <h2 style={{ marginBottom: 18 }}>Segmentación por bout</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bout</th>
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
