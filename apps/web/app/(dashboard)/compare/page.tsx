import { CompareSelector } from "@/components/compare-selector";
import Plot from "@/components/plot";
import { RoadmapAIReport } from "@/components/roadmap-ai-report";
import { RoadmapManager } from "@/components/roadmap-manager";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { formatCapturedAt } from "@/lib/roadmap";
import { isRoadmapAIEnabled } from "@/lib/roadmap-ai";

type ComparePageSearchParams = {
  ids?: string;
  roadmap?: string;
};

export default async function ComparePage({
  searchParams
}: {
  searchParams: Promise<ComparePageSearchParams>;
}) {
  const { ids, roadmap } = await searchParams;
  const manualIds = (ids ?? "").split(",").filter(Boolean);
  const { supabase, user } = await requireUser();
  const roadmapAIEnabled = isRoadmapAIEnabled();

  const [{ data: sessions }, { data: roadmaps }, { data: activeRoadmap }, { data: activeRoadmapLinks }, { data: roadmapReport }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("id,name,status,captured_at_local,created_at,raw_zip_name")
        .eq("user_id", user.id)
        .order("captured_at_local", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase.from("training_roadmaps").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      roadmap
        ? supabase.from("training_roadmaps").select("*").eq("id", roadmap).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      roadmap
        ? supabase.from("roadmap_sessions").select("*").eq("roadmap_id", roadmap).order("position").order("added_at")
        : Promise.resolve({ data: [] as any[] }),
      roadmap ? supabase.from("roadmap_ai_reports").select("*").eq("roadmap_id", roadmap).maybeSingle() : Promise.resolve({ data: null })
    ]);

  const sessionById = new Map((sessions ?? []).map((row: any) => [row.id, row]));
  const roadmapIds = (activeRoadmapLinks ?? []).map((row: any) => row.session_id);
  const compareSessionIds = roadmap ? roadmapIds : manualIds;

  const [{ data: summaries }, { data: featurePoints }] = await Promise.all([
    compareSessionIds.length
      ? supabase.from("session_summaries").select("*").in("session_id", compareSessionIds)
      : Promise.resolve({ data: [] as any[] }),
    compareSessionIds.length
      ? supabase
          .from("session_feature_points")
          .select("session_id,t_center,speed_kmh,effort_score,cadence_spm,impact_peak_mps2,jerk_rms_mps3")
          .in("session_id", compareSessionIds)
          .order("t_center")
      : Promise.resolve({ data: [] as any[] })
  ]);

  const summaryById = new Map((summaries ?? []).map((row: any) => [row.session_id, row]));
  const compareRows = compareSessionIds
    .map((sessionId) => {
      const summary = summaryById.get(sessionId);
      const session = sessionById.get(sessionId);
      if (!summary || !session) {
        return null;
      }
      return {
        ...summary,
        name: session.name ?? summary.session_id,
        captured_at_local: session.captured_at_local ?? null,
        created_at: session.created_at ?? null,
        timeline_label: formatCapturedAt(session.captured_at_local ?? session.created_at)
      };
    })
    .filter(Boolean) as any[];

  const featureSeries = compareRows.map((row) => {
    const points = (featurePoints ?? []).filter((point: any) => point.session_id === row.session_id);
    const t0 = points[0]?.t_center ?? 0;
    return {
      session_id: row.session_id,
      name: row.name,
      timeline_label: row.timeline_label,
      t: points.map((point: any) => point.t_center - t0),
      speed: points.map((point: any) => point.speed_kmh),
      effort: points.map((point: any) => point.effort_score),
      cadence: points.map((point: any) => point.cadence_spm),
      impact: points.map((point: any) => point.impact_peak_mps2),
      jerk: points.map((point: any) => point.jerk_rms_mps3)
    };
  });

  const roadmapSessionItems = (activeRoadmapLinks ?? []).map((link: any) => ({
    session_id: link.session_id,
    position: link.position,
    session: sessionById.get(link.session_id) ?? null
  }));

  return (
    <>
      <CompareSelector sessions={(sessions ?? []) as any[]} selectedIds={compareSessionIds} />

      <RoadmapManager
        sessions={(sessions ?? []) as any[]}
        selectedIds={manualIds}
        roadmaps={(roadmaps ?? []) as any[]}
        activeRoadmap={(activeRoadmap as any) ?? null}
        activeRoadmapSessions={roadmapSessionItems}
      />

      {activeRoadmap && compareRows.length ? (
        <>
          <section className="surface card">
            <p className="eyebrow">Bloque</p>
            <h2 style={{ marginBottom: 18 }}>Resumen del roadmap</h2>
            <div className="metric-grid">
              <article className="metric-card">
                <span>Entrenamientos en el roadmap</span>
                <strong>{compareRows.length}</strong>
              </article>
              <article className="metric-card">
                <span>Objetivo del bloque</span>
                <strong>{activeRoadmap.target_training_count ?? "n/d"}</strong>
              </article>
              <article className="metric-card">
                <span>Primera sesión</span>
                <strong>{compareRows[0]?.timeline_label ?? "n/d"}</strong>
              </article>
              <article className="metric-card">
                <span>Última sesión</span>
                <strong>{compareRows[compareRows.length - 1]?.timeline_label ?? "n/d"}</strong>
              </article>
            </div>
          </section>
          <RoadmapAIReport
            roadmapId={activeRoadmap.id}
            aiEnabled={roadmapAIEnabled}
            initialReportText={roadmapReport?.report_text ?? null}
            initialModel={roadmapReport?.model ?? null}
          />
          <section className="surface card">
            <p className="eyebrow">Evolución</p>
            <h2 style={{ marginBottom: 18 }}>Cómo progresa el roadmap entre entrenamientos</h2>
            <div className="chart-shell">
              <Plot
                data={[
                  {
                    x: compareRows.map((row) => row.timeline_label),
                    y: compareRows.map((row) => row.peak_speed_kmh),
                    type: "scatter",
                    mode: "lines+markers",
                    name: "Velocidad pico",
                    line: { color: "#1565c0" }
                  },
                  {
                    x: compareRows.map((row) => row.timeline_label),
                    y: compareRows.map((row) => row.best_sprint_launch_peak_accel_mps2),
                    type: "scatter",
                    mode: "lines+markers",
                    name: "Acel. partida",
                    yaxis: "y2",
                    line: { color: "#1f6f4a" }
                  },
                  {
                    x: compareRows.map((row) => row.timeline_label),
                    y: compareRows.map((row) => row.best_sprint_plateau_duration_s),
                    type: "scatter",
                    mode: "lines+markers",
                    name: "Meseta",
                    yaxis: "y2",
                    line: { color: "#ef6c00" }
                  }
                ]}
                layout={{
                  autosize: true,
                  height: 420,
                  margin: { l: 50, r: 50, t: 20, b: 70 },
                  paper_bgcolor: "white",
                  plot_bgcolor: "white",
                  xaxis: { title: "Entrenamiento" },
                  yaxis: { title: "km/h" },
                  yaxis2: { title: "m/s2 o s", overlaying: "y", side: "right" }
                }}
                config={{ responsive: true, displaylogo: false }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </section>
        </>
      ) : null}

      {compareRows.length ? (
        <>
          <section className="surface card">
            <p className="eyebrow">Explosividad</p>
            <h2 style={{ marginBottom: 18 }}>Velocidad, salida y sostén del pique</h2>
            <div className="chart-shell">
              <Plot
                data={[
                  {
                    x: compareRows.map((row) => row.name),
                    y: compareRows.map((row) => row.peak_speed_kmh),
                    type: "bar",
                    name: "Velocidad pico",
                    marker: { color: "#1565c0" }
                  },
                  {
                    x: compareRows.map((row) => row.name),
                    y: compareRows.map((row) => row.best_sprint_launch_peak_accel_mps2),
                    type: "bar",
                    name: "Acel. partida",
                    marker: { color: "#1f6f4a" }
                  },
                  {
                    x: compareRows.map((row) => row.name),
                    y: compareRows.map((row) => row.best_3s_speed_kmh),
                    type: "bar",
                    name: "Mejor 3s",
                    marker: { color: "#ef6c00" }
                  },
                  {
                    x: compareRows.map((row) => row.name),
                    y: compareRows.map((row) => row.best_5s_speed_kmh),
                    type: "bar",
                    name: "Mejor 5s",
                    marker: { color: "#6a1b9a" }
                  }
                ]}
                layout={{
                  barmode: "group",
                  autosize: true,
                  height: 420,
                  margin: { l: 40, r: 20, t: 20, b: 80 },
                  paper_bgcolor: "white",
                  plot_bgcolor: "white"
                }}
                config={{ responsive: true, displaylogo: false }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </section>

          <section className="surface card">
            <p className="eyebrow">Carga y técnica</p>
            <h2 style={{ marginBottom: 18 }}>Esfuerzo, cadencia e impacto</h2>
            <div className="chart-shell">
              <Plot
                data={[
                  {
                    x: compareRows.map((row) => row.name),
                    y: compareRows.map((row) => row.peak_effort_score),
                    type: "bar",
                    name: "Esfuerzo pico",
                    marker: { color: "#d81b60" }
                  },
                  {
                    x: compareRows.map((row) => row.name),
                    y: compareRows.map((row) => row.peak_cadence_spm),
                    type: "bar",
                    name: "Cadencia pico",
                    marker: { color: "#fb8c00" }
                  },
                  {
                    x: compareRows.map((row) => row.name),
                    y: compareRows.map((row) => row.peak_impact_mps2),
                    type: "bar",
                    name: "Impacto pico",
                    marker: { color: "#5e35b1" }
                  },
                  {
                    x: compareRows.map((row) => row.name),
                    y: compareRows.map((row) => row.peak_jerk_mps3),
                    type: "bar",
                    name: "Jerk pico",
                    marker: { color: "#00838f" }
                  }
                ]}
                layout={{
                  barmode: "group",
                  autosize: true,
                  height: 420,
                  margin: { l: 40, r: 20, t: 20, b: 80 },
                  paper_bgcolor: "white",
                  plot_bgcolor: "white"
                }}
                config={{ responsive: true, displaylogo: false }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </section>

          <section className="surface card">
            <p className="eyebrow">Curvas</p>
            <h2 style={{ marginBottom: 18 }}>Velocidad comparada a lo largo de la sesión</h2>
            <div className="chart-shell">
              <Plot
                data={featureSeries.map((series) => ({
                  x: series.t,
                  y: series.speed,
                  type: "scatter",
                  mode: "lines",
                  name: series.name
                }))}
                layout={{
                  autosize: true,
                  height: 420,
                  margin: { l: 50, r: 20, t: 20, b: 40 },
                  paper_bgcolor: "white",
                  plot_bgcolor: "white",
                  xaxis: { title: "Tiempo relativo (s)" },
                  yaxis: { title: "km/h" }
                }}
                config={{ responsive: true, displaylogo: false }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </section>

          <section className="surface card">
            <p className="eyebrow">Curvas</p>
            <h2 style={{ marginBottom: 18 }}>Esfuerzo comparado a lo largo de la sesión</h2>
            <div className="chart-shell">
              <Plot
                data={featureSeries.map((series) => ({
                  x: series.t,
                  y: series.effort,
                  type: "scatter",
                  mode: "lines",
                  name: series.name
                }))}
                layout={{
                  autosize: true,
                  height: 420,
                  margin: { l: 50, r: 20, t: 20, b: 40 },
                  paper_bgcolor: "white",
                  plot_bgcolor: "white",
                  xaxis: { title: "Tiempo relativo (s)" },
                  yaxis: { title: "Esfuerzo", range: [0, 100] }
                }}
                config={{ responsive: true, displaylogo: false }}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </section>

          <section className="surface card">
            <p className="eyebrow">Tabla</p>
            <h2 style={{ marginBottom: 18 }}>Comparación ampliada</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sesión</th>
                    <th>Fecha</th>
                    <th>Vmax</th>
                    <th>Mejor 3s</th>
                    <th>Mejor 5s</th>
                    <th>Apartida</th>
                    <th>T50</th>
                    <th>T90</th>
                    <th>Meseta</th>
                    <th>Bajada</th>
                    <th>Esf. pico</th>
                    <th>Cadencia</th>
                    <th>Impacto</th>
                    <th>Jerk</th>
                    <th>GPS</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.session_id}>
                      <td>{row.name}</td>
                      <td>{row.timeline_label}</td>
                      <td>{fmt(row.peak_speed_kmh)} km/h</td>
                      <td>{fmt(row.best_3s_speed_kmh)} km/h</td>
                      <td>{fmt(row.best_5s_speed_kmh)} km/h</td>
                      <td>{fmt(row.best_sprint_launch_peak_accel_mps2)} m/s2</td>
                      <td>{fmt(row.best_sprint_time_to_50pct_peak_s)} s</td>
                      <td>{fmt(row.best_sprint_time_to_90pct_peak_s)} s</td>
                      <td>{fmt(row.best_sprint_plateau_duration_s)} s</td>
                      <td>{fmt(row.best_sprint_decel_duration_s)} s</td>
                      <td>{fmt(row.peak_effort_score)}</td>
                      <td>{fmt(row.peak_cadence_spm)} spm</td>
                      <td>{fmt(row.peak_impact_mps2)} m/s2</td>
                      <td>{fmt(row.peak_jerk_mps3)} m/s3</td>
                      <td>{fmt(row.gps_quality_pct)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="surface card">
          <p className="eyebrow">Comparación</p>
          <h2>Selecciona dos o más sesiones o abre un roadmap</h2>
          <p className="muted">
            Puedes comparar sesiones sueltas o guardarlas como roadmap para seguir la evolución del bloque con fechas, cantidad de entrenamientos y análisis IA.
          </p>
        </section>
      )}
    </>
  );
}
