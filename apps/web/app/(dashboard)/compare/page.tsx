import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { CompareSelector } from "@/components/compare-selector";
import Plot from "@/components/plot";

export default async function ComparePage({
  searchParams
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const selectedIds = (ids ?? "").split(",").filter(Boolean);
  const { supabase, user } = await requireUser();

  const [{ data: sessions }, { data: summaries }, { data: featurePoints }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id,name,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    selectedIds.length
      ? supabase.from("session_summaries").select("*").in("session_id", selectedIds)
      : Promise.resolve({ data: [] as any[] }),
    selectedIds.length
      ? supabase
          .from("session_feature_points")
          .select("session_id,t_center,speed_kmh,effort_score,cadence_spm,impact_peak_mps2,jerk_rms_mps3")
          .in("session_id", selectedIds)
          .order("t_center")
      : Promise.resolve({ data: [] as any[] })
  ]);

  const compareRows = (summaries ?? []).map((row: any) => {
    const session = (sessions ?? []).find((item: any) => item.id === row.session_id);
    return {
      ...row,
      name: session?.name ?? row.session_id
    };
  });

  const featureSeries = compareRows.map((row) => {
    const points = (featurePoints ?? []).filter((point: any) => point.session_id === row.session_id);
    const t0 = points[0]?.t_center ?? 0;
    return {
      session_id: row.session_id,
      name: row.name,
      t: points.map((point: any) => point.t_center - t0),
      speed: points.map((point: any) => point.speed_kmh),
      effort: points.map((point: any) => point.effort_score),
      cadence: points.map((point: any) => point.cadence_spm),
      impact: points.map((point: any) => point.impact_peak_mps2),
      jerk: points.map((point: any) => point.jerk_rms_mps3)
    };
  });

  return (
    <>
      <CompareSelector sessions={(sessions ?? []) as any[]} />

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
          <h2>Selecciona dos o más sesiones</h2>
          <p className="muted">
            El foco aquí es comparar explosividad de salida, velocidad pico y degradación del esfuerzo entre pruebas.
          </p>
        </section>
      )}
    </>
  );
}
