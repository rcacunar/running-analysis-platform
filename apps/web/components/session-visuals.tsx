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
  horizontal_rms_mps2?: number | null;
  vertical_rms_mps2?: number | null;
  gyro_rms_rads?: number | null;
  orientation_rate_rads?: number | null;
  gps_accel_mps2?: number | null;
  gps_quality_score?: number | null;
  horizontal_accuracy_m?: number | null;
  effort_raw?: number | null;
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
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);

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
  const currentTime = current?.t_center ?? 0;
  const nextRouteIndex = route.findIndex((row) => row.t_center >= currentTime);
  const currentRouteIndex = nextRouteIndex >= 0 ? nextRouteIndex : Math.max(0, route.length - 1);
  const currentDistance = current?.gps_distance_m ?? route[currentRouteIndex]?.gps_distance_m ?? null;

  function timelineShapes() {
    return [
      ...phaseShapes,
      ...sprintShapes,
      {
        type: "line" as const,
        x0: currentTime,
        x1: currentTime,
        y0: 0,
        y1: 1,
        xref: "x",
        yref: "paper",
        line: { color: "#0f1a16", width: 2, dash: "dot" }
      }
    ];
  }

  function handleTimelineRelayout(event: Record<string, unknown>) {
    const start = event["xaxis.range[0]"];
    const end = event["xaxis.range[1]"];
    const autorange = event["xaxis.autorange"];
    if (autorange) {
      setTimeRange(null);
      return;
    }
    if (typeof start === "number" && typeof end === "number") {
      setTimeRange([start, end]);
      return;
    }
    if (typeof start === "string" && typeof end === "string") {
      const parsedStart = Number(start);
      const parsedEnd = Number(end);
      if (Number.isFinite(parsedStart) && Number.isFinite(parsedEnd)) {
        setTimeRange([parsedStart, parsedEnd]);
      }
    }
  }

  function sharedTimeAxis() {
    return timeRange ? { title: "Tiempo (s)", range: timeRange } : { title: "Tiempo (s)" };
  }

  return (
    <div className="visual-stack">
      <section className="surface card sticky-playback-bar">
        <p className="eyebrow">Control Global</p>
        <h2 style={{ marginBottom: 12 }}>Playback sincronizado de toda la sesión</h2>
        <div className="playback-controls">
          <button className="button-secondary" onClick={() => setPlaying((value) => !value)}>
            {playing ? "Pausar" : "Reproducir"}
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
          />
          <div className="playback-readout muted">
            <span>t={currentTime.toFixed(1)}s</span>
            <span>vel={current?.speed_kmh?.toFixed(1) ?? "n/d"} km/h</span>
            <span>fase={current?.phase ?? "n/d"}</span>
            <span>dist={currentDistance?.toFixed(1) ?? "n/d"} m</span>
          </div>
        </div>
      </section>

      <section className="chart-section">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Velocidad</p>
            <h2>Velocidad y aceleración del pique</h2>
          </div>
          <p className="muted">La línea vertical sigue el instante actual del playback global.</p>
        </div>
        <div className="chart-shell chart-shell-wide">
          <Plot
            data={[
              {
                x: times,
                y: features.map((row) => row.speed_kmh),
                type: "scatter",
                mode: "lines",
                name: "Velocidad",
                line: { color: "#1565c0", width: 3 }
              },
              {
                x: times,
                y: features.map((row) => row.speed_accel_mps2),
                type: "scatter",
                mode: "lines",
                name: "Aceleración",
                line: { color: "#43a047", width: 2 },
                yaxis: "y2"
              }
            ]}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 50, r: 60, t: 12, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: sharedTimeAxis(),
              yaxis: { title: "km/h" },
              yaxis2: { title: "m/s2", overlaying: "y", side: "right" },
              shapes: timelineShapes()
            }}
            config={{ responsive: true, displaylogo: false }}
            onRelayout={handleTimelineRelayout}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      <section className="chart-section">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Esfuerzo</p>
            <h2>Esfuerzo y cadencia</h2>
          </div>
        </div>
        <div className="chart-shell chart-shell-wide">
          <Plot
            data={[
              {
                x: times,
                y: features.map((row) => row.effort_score),
                type: "scatter",
                mode: "lines",
                name: "Esfuerzo",
                line: { color: "#d81b60", width: 3 }
              },
              {
                x: times,
                y: features.map((row) => row.cadence_spm),
                type: "scatter",
                mode: "lines",
                name: "Cadencia",
                line: { color: "#ef6c00", width: 2 },
                yaxis: "y2"
              }
            ]}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 50, r: 60, t: 12, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: sharedTimeAxis(),
              yaxis: { title: "Esfuerzo", range: [0, 100] },
              yaxis2: { title: "spm", overlaying: "y", side: "right" },
              shapes: timelineShapes()
            }}
            config={{ responsive: true, displaylogo: false }}
            onRelayout={handleTimelineRelayout}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      <section className="chart-section">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Biomecánica</p>
            <h2>Impacto y jerk</h2>
          </div>
        </div>
        <div className="chart-shell chart-shell-wide">
          <Plot
            data={[
              {
                x: times,
                y: features.map((row) => row.impact_peak_mps2),
                type: "scatter",
                mode: "lines",
                name: "Impacto pico",
                line: { color: "#6a1b9a", width: 2.5 }
              },
              {
                x: times,
                y: features.map((row) => row.jerk_rms_mps3),
                type: "scatter",
                mode: "lines",
                name: "Jerk RMS",
                line: { color: "#00838f", width: 2.5 },
                yaxis: "y2"
              }
            ]}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 50, r: 60, t: 12, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: sharedTimeAxis(),
              yaxis: { title: "m/s2" },
              yaxis2: { title: "m/s3", overlaying: "y", side: "right" },
              shapes: timelineShapes()
            }}
            config={{ responsive: true, displaylogo: false }}
            onRelayout={handleTimelineRelayout}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      <section className="chart-section">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Estabilidad</p>
            <h2>Oscilación horizontal y vertical</h2>
          </div>
        </div>
        <div className="chart-shell chart-shell-wide">
          <Plot
            data={[
              {
                x: times,
                y: features.map((row) => row.horizontal_rms_mps2),
                type: "scatter",
                mode: "lines",
                name: "Horizontal RMS",
                line: { color: "#3949ab", width: 2.5 }
              },
              {
                x: times,
                y: features.map((row) => row.vertical_rms_mps2),
                type: "scatter",
                mode: "lines",
                name: "Vertical RMS",
                line: { color: "#00897b", width: 2.5 },
                yaxis: "y2"
              }
            ]}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 50, r: 60, t: 12, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: sharedTimeAxis(),
              yaxis: { title: "m/s2" },
              yaxis2: { title: "m/s2", overlaying: "y", side: "right" },
              shapes: timelineShapes()
            }}
            config={{ responsive: true, displaylogo: false }}
            onRelayout={handleTimelineRelayout}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      <section className="chart-section">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Rotación</p>
            <h2>Giroscopio y tasa de orientación</h2>
          </div>
        </div>
        <div className="chart-shell chart-shell-wide">
          <Plot
            data={[
              {
                x: times,
                y: features.map((row) => row.gyro_rms_rads),
                type: "scatter",
                mode: "lines",
                name: "Gyro RMS",
                line: { color: "#8e24aa", width: 2.5 }
              },
              {
                x: times,
                y: features.map((row) => row.orientation_rate_rads),
                type: "scatter",
                mode: "lines",
                name: "Orientation rate",
                line: { color: "#f4511e", width: 2.5 },
                yaxis: "y2"
              }
            ]}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 50, r: 60, t: 12, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: sharedTimeAxis(),
              yaxis: { title: "rad/s" },
              yaxis2: { title: "rad/s", overlaying: "y", side: "right" },
              shapes: timelineShapes()
            }}
            config={{ responsive: true, displaylogo: false }}
            onRelayout={handleTimelineRelayout}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      <section className="chart-section">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Señal GPS</p>
            <h2>Calidad GPS, precisión y aceleración derivada</h2>
          </div>
        </div>
        <div className="chart-shell chart-shell-wide">
          <Plot
            data={[
              {
                x: times,
                y: features.map((row) => row.gps_quality_score),
                type: "scatter",
                mode: "lines",
                name: "GPS quality",
                line: { color: "#2e7d32", width: 2.5 }
              },
              {
                x: times,
                y: features.map((row) => row.horizontal_accuracy_m),
                type: "scatter",
                mode: "lines",
                name: "Precisión horizontal",
                line: { color: "#c62828", width: 2.5 },
                yaxis: "y2"
              },
              {
                x: times,
                y: features.map((row) => row.gps_accel_mps2),
                type: "scatter",
                mode: "lines",
                name: "GPS accel",
                line: { color: "#0277bd", width: 2 },
                yaxis: "y3"
              }
            ]}
            layout={{
              autosize: true,
              height: 340,
              margin: { l: 50, r: 80, t: 12, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: sharedTimeAxis(),
              yaxis: { title: "score" },
              yaxis2: { title: "m", overlaying: "y", side: "right" },
              yaxis3: { title: "m/s2", anchor: "free", overlaying: "y", side: "right", position: 0.96 },
              shapes: timelineShapes()
            }}
            config={{ responsive: true, displaylogo: false }}
            onRelayout={handleTimelineRelayout}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      <section className="chart-section">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Progreso GPS</p>
            <h2>Distancia acumulada y velocidad</h2>
          </div>
        </div>
        <div className="chart-shell chart-shell-wide">
          <Plot
            data={[
              {
                x: playback.map((row) => row.t_center),
                y: playback.map((row) => row.gps_distance_m),
                type: "scatter",
                mode: "lines",
                name: "Distancia",
                line: { color: "#00796b", width: 3 }
              },
              {
                x: playback.map((row) => row.t_center),
                y: playback.map((row) => row.speed_kmh),
                type: "scatter",
                mode: "lines",
                name: "Velocidad",
                line: { color: "#1565c0", width: 2 },
                yaxis: "y2"
              }
            ]}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 50, r: 60, t: 12, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: sharedTimeAxis(),
              yaxis: { title: "m" },
              yaxis2: { title: "km/h", overlaying: "y", side: "right" },
              shapes: timelineShapes()
            }}
            config={{ responsive: true, displaylogo: false }}
            onRelayout={handleTimelineRelayout}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      <section className="chart-section">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Lectura Integrada</p>
            <h2>Vista combinada de la sesión</h2>
          </div>
        </div>
        <div className="chart-shell chart-shell-wide">
          <Plot
            data={[
              { x: times, y: features.map((row) => row.speed_kmh), type: "scatter", mode: "lines", name: "Velocidad", line: { color: "#1565c0" } },
              { x: times, y: features.map((row) => row.effort_score), type: "scatter", mode: "lines", name: "Esfuerzo", line: { color: "#d81b60" }, yaxis: "y2" },
              { x: times, y: features.map((row) => row.speed_accel_mps2), type: "scatter", mode: "lines", name: "Aceleración", line: { color: "#43a047" }, yaxis: "y3" },
              { x: times, y: features.map((row) => row.cadence_spm), type: "scatter", mode: "lines", name: "Cadencia", line: { color: "#ef6c00" }, yaxis: "y4" }
            ]}
            layout={{
              autosize: true,
              height: 360,
              margin: { l: 50, r: 80, t: 12, b: 40 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              xaxis: sharedTimeAxis(),
              yaxis: { title: "km/h" },
              yaxis2: { title: "Esfuerzo", overlaying: "y", side: "right", range: [0, 100] },
              yaxis3: { title: "m/s2", anchor: "free", overlaying: "y", side: "left", position: 0.04 },
              yaxis4: { title: "spm", anchor: "free", overlaying: "y", side: "right", position: 0.97 },
              shapes: timelineShapes()
            }}
            config={{ responsive: true, displaylogo: false }}
            onRelayout={handleTimelineRelayout}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      <section className="chart-section">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Ruta GPS</p>
            <h2>Mapa del desplazamiento y esfuerzo</h2>
          </div>
        </div>
        <div className="playback-panel chart-shell-wide">
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
              height: 520,
              margin: { l: 50, r: 20, t: 12, b: 40 },
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
