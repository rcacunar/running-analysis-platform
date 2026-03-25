"use client";

import { useEffect, useState } from "react";
import Plot from "@/components/plot";

type Point = {
  t_center: number;
  speed_kmh: number | null;
  effort_score: number | null;
  cadence_spm?: number | null;
  speed_accel_mps2?: number | null;
  impact_peak_mps2?: number | null;
  jerk_rms_mps3?: number | null;
  phase?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_distance_m?: number | null;
};

type Phase = {
  phase: string;
  t_start_s: number;
  t_end_s: number;
};

type Sprint = {
  t_start_s: number;
  t_end_s: number;
};

function phaseColor(name?: string | null) {
  switch (name) {
    case "partida":
      return "rgba(46,125,50,0.18)";
    case "aceleracion":
      return "rgba(67,160,71,0.18)";
    case "meseta":
      return "rgba(251,192,45,0.18)";
    case "bajada_ritmo":
      return "rgba(239,108,0,0.18)";
    case "detencion":
      return "rgba(229,57,53,0.18)";
    default:
      return "rgba(120,144,156,0.14)";
  }
}

export function SessionVisuals({
  features,
  playback,
  phases,
  sprints
}: {
  features: Point[];
  playback: Point[];
  phases: Phase[];
  sprints: Sprint[];
}) {
  const route = playback.filter((row) => row.latitude != null && row.longitude != null);
  const times = features.map((row) => row.t_center);
  const phaseShapes = phases.flatMap((phase) => [
    {
      type: "rect" as const,
      x0: phase.t_start_s,
      x1: phase.t_end_s,
      y0: 0,
      y1: 1,
      xref: "x",
      yref: "paper",
      fillcolor: phaseColor(phase.phase),
      line: { width: 0 }
    }
  ]);
  const sprintShapes = sprints.map((sprint) => ({
    type: "rect" as const,
    x0: sprint.t_start_s,
    x1: sprint.t_end_s,
    y0: 0,
    y1: 1,
    xref: "x",
    yref: "paper",
    fillcolor: "rgba(180,0,0,0.08)",
    line: { width: 0 }
  }));

  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    if (!playing || playback.length === 0) return;
    const timer = window.setInterval(() => {
      setFrame((current) => {
        const next = current + rate;
        if (next >= playback.length - 1) {
          setPlaying(false);
          return playback.length - 1;
        }
        return next;
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [playing, rate, playback.length]);

  const current = playback[Math.floor(frame)] ?? playback[0];
  const currentRouteIndex =
    route.findIndex((row) => row.t_center >= (current?.t_center ?? 0)) >= 0
      ? route.findIndex((row) => row.t_center >= (current?.t_center ?? 0))
      : route.length - 1;

  return (
    <div className="grid-2">
      <section className="surface card">
        <p className="eyebrow">Series</p>
        <h2 style={{ marginBottom: 18 }}>Velocidad, esfuerzo y biomecánica</h2>
        <div className="chart-shell">
          <Plot
            data={[
              { x: times, y: features.map((row) => row.speed_kmh), type: "scatter", mode: "lines", name: "Velocidad", line: { color: "#1565c0" } },
              { x: times, y: features.map((row) => row.effort_score), type: "scatter", mode: "lines", name: "Esfuerzo", line: { color: "#d81b60" }, yaxis: "y2" },
              { x: times, y: features.map((row) => row.speed_accel_mps2), type: "scatter", mode: "lines", name: "Aceleración", line: { color: "#43a047" }, yaxis: "y3" }
            ]}
            layout={{
              autosize: true,
              height: 420,
              margin: { l: 50, r: 50, t: 20, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: { title: "Tiempo (s)" },
              yaxis: { title: "km/h" },
              yaxis2: { title: "Esfuerzo", overlaying: "y", side: "right", range: [0, 100] },
              yaxis3: { title: "m/s2", anchor: "free", overlaying: "y", side: "left", position: 0.06 },
              shapes: [...phaseShapes, ...sprintShapes]
            }}
            config={{ responsive: true, displaylogo: false }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      <section className="surface card">
        <p className="eyebrow">Playback</p>
        <h2 style={{ marginBottom: 18 }}>Ruta y esfuerzo sincronizados</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <button className="button-secondary" onClick={() => setPlaying((value) => !value)}>
            {playing ? "Pause" : "Play"}
          </button>
          <select value={rate} onChange={(event) => setRate(Number(event.target.value))}>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
          <input
            type="range"
            min={0}
            max={Math.max(0, playback.length - 1)}
            value={Math.floor(frame)}
            onChange={(event) => setFrame(Number(event.target.value))}
            style={{ flex: 1 }}
          />
          <span className="muted">
            t={current?.t_center?.toFixed(1) ?? "n/d"}s | vel={current?.speed_kmh?.toFixed(1) ?? "n/d"} km/h | fase={current?.phase ?? "n/d"}
          </span>
        </div>
        <div className="playback-panel">
          <Plot
            data={[
              {
                x: route.map((row) => row.longitude),
                y: route.map((row) => row.latitude),
                type: "scatter",
                mode: "lines",
                name: "Ruta",
                line: { color: "rgba(120,120,120,0.55)", width: 2 }
              },
              {
                x: route.slice(0, currentRouteIndex + 1).map((row) => row.longitude),
                y: route.slice(0, currentRouteIndex + 1).map((row) => row.latitude),
                type: "scatter",
                mode: "markers+lines",
                name: "Trail",
                marker: {
                  size: 9,
                  color: route.slice(0, currentRouteIndex + 1).map((row) => row.effort_score),
                  colorscale: "Turbo",
                  cmin: 0,
                  cmax: 100,
                  line: { color: "#fff", width: 0.5 }
                },
                line: { color: "rgba(216,27,96,0.65)", width: 2 }
              },
              currentRouteIndex >= 0
                ? {
                    x: [route[currentRouteIndex]?.longitude],
                    y: [route[currentRouteIndex]?.latitude],
                    type: "scatter",
                    mode: "markers",
                    name: "Actual",
                    marker: { size: 16, color: "#ffeb3b", line: { color: "#111", width: 1.2 } }
                  }
                : null
            ].filter(Boolean)}
            layout={{
              autosize: true,
              height: 420,
              margin: { l: 50, r: 20, t: 20, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: { title: "Longitud" },
              yaxis: { title: "Latitud", scaleanchor: "x", scaleratio: 1 }
            }}
            config={{ responsive: true, displaylogo: false }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>
    </div>
  );
}
