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

  const [{ data: sessions }, { data: summaries }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id,name,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    selectedIds.length
      ? supabase.from("session_summaries").select("*").in("session_id", selectedIds)
      : Promise.resolve({ data: [] as any[] })
  ]);

  const compareRows = (summaries ?? []).map((row: any) => {
    const session = (sessions ?? []).find((item: any) => item.id === row.session_id);
    return {
      ...row,
      name: session?.name ?? row.session_id
    };
  });

  return (
    <>
      <CompareSelector sessions={(sessions ?? []) as any[]} />

      {compareRows.length ? (
        <section className="surface card">
          <p className="eyebrow">Comparación</p>
          <h2 style={{ marginBottom: 18 }}>Métricas comparables</h2>
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
                  y: compareRows.map((row) => row.best_sprint_time_to_90pct_peak_s),
                  type: "bar",
                  name: "Tiempo a 90%",
                  marker: { color: "#d95f02" }
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sesión</th>
                  <th>Vmax</th>
                  <th>Apartida</th>
                  <th>T50</th>
                  <th>T90</th>
                  <th>Meseta</th>
                  <th>Bajada</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row.session_id}>
                    <td>{row.name}</td>
                    <td>{fmt(row.peak_speed_kmh)} km/h</td>
                    <td>{fmt(row.best_sprint_launch_peak_accel_mps2)} m/s2</td>
                    <td>{fmt(row.best_sprint_time_to_50pct_peak_s)} s</td>
                    <td>{fmt(row.best_sprint_time_to_90pct_peak_s)} s</td>
                    <td>{fmt(row.best_sprint_plateau_duration_s)} s</td>
                    <td>{fmt(row.best_sprint_decel_duration_s)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
