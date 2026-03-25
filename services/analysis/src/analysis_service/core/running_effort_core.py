#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from scipy.signal import welch

from .script_paths import resolve_input_path


@dataclass
class RunningAnalysis:
    folder: Path
    motion: pd.DataFrame
    location: pd.DataFrame
    features: pd.DataFrame
    bouts: pd.DataFrame
    phases: pd.DataFrame
    sprints: pd.DataFrame
    playback: pd.DataFrame
    summary: dict
    summary_table: pd.DataFrame


def robust_z(values: Iterable[float]) -> np.ndarray:
    arr = np.asarray(list(values), dtype=float)
    med = np.nanmedian(arr)
    mad = np.nanmedian(np.abs(arr - med))
    if not np.isfinite(mad) or mad < 1e-9:
        return np.zeros_like(arr)
    return (arr - med) / (1.4826 * mad)


def normalize_score(values: Iterable[float], q_low: float = 0.05, q_high: float = 0.95) -> np.ndarray:
    arr = np.asarray(list(values), dtype=float)
    if len(arr) == 0:
        return arr
    lo = np.nanquantile(arr, q_low)
    hi = np.nanquantile(arr, q_high)
    if not np.isfinite(lo) or not np.isfinite(hi) or abs(hi - lo) < 1e-9:
        return np.full_like(arr, 50.0)
    return np.clip(100.0 * (arr - lo) / (hi - lo), 0.0, 100.0)


def safe_seconds_elapsed(df: pd.DataFrame) -> pd.DataFrame:
    if "seconds_elapsed" not in df.columns:
        raise RuntimeError("Expected a seconds_elapsed column.")
    return df.sort_values("seconds_elapsed").reset_index(drop=True)


def standardize_xyz(df: pd.DataFrame, label: str) -> pd.DataFrame:
    cols = {c.lower(): c for c in df.columns}
    missing = [axis for axis in ("x", "y", "z") if axis not in cols]
    if missing:
        raise RuntimeError(f"{label}: missing columns {missing}")
    renamed = df.rename(columns={cols["x"]: "x", cols["y"]: "y", cols["z"]: "z"})
    return safe_seconds_elapsed(renamed)


def haversine_step_distances(lat_deg: np.ndarray, lon_deg: np.ndarray) -> np.ndarray:
    radius_m = 6_371_000.0
    lat = np.radians(lat_deg.astype(float))
    lon = np.radians(lon_deg.astype(float))
    out = np.zeros(len(lat), dtype=float)
    if len(lat) < 2:
        return out
    dlat = np.diff(lat)
    dlon = np.diff(lon)
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat[:-1]) * np.cos(lat[1:]) * np.sin(dlon / 2.0) ** 2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    out[1:] = radius_m * c
    return out


def merge_zones(times: Iterable[float], mask: Iterable[bool], min_duration_s: float) -> list[tuple[float, float]]:
    times_arr = np.asarray(list(times), dtype=float)
    mask_arr = np.asarray(list(mask), dtype=bool)
    zones: list[tuple[float, float]] = []
    start = None
    for idx, active in enumerate(mask_arr):
        if active and start is None:
            start = times_arr[idx]
        if start is not None and (not active):
            end = times_arr[idx - 1]
            if end - start >= min_duration_s:
                zones.append((float(start), float(end)))
            start = None
    if start is not None and times_arr[-1] - start >= min_duration_s:
        zones.append((float(start), float(times_arr[-1])))
    return zones


def first_index_where(mask: np.ndarray) -> int | None:
    idx = np.flatnonzero(mask)
    return int(idx[0]) if len(idx) else None


def add_phase_rows(
    phase_rows: list[dict],
    bout_id: int,
    sprint_id: float,
    phase: str,
    sub: pd.DataFrame,
    start_idx: int | None,
    end_idx: int | None,
) -> None:
    if start_idx is None or end_idx is None or end_idx < start_idx:
        return
    chunk = sub.iloc[start_idx : end_idx + 1]
    if chunk.empty:
        return
    t_start = float(chunk["t_center"].iloc[0])
    t_end = float(chunk["t_center"].iloc[-1])
    distance = np.nan
    if chunk["gps_distance_m"].notna().any():
        distance = float(chunk["gps_distance_m"].iloc[-1] - chunk["gps_distance_m"].iloc[0])
    phase_rows.append(
        {
            "bout_id": bout_id,
            "sprint_id": sprint_id if pd.notna(sprint_id) else np.nan,
            "phase": phase,
            "t_start_s": t_start,
            "t_end_s": t_end,
            "duration_s": float(max(0.0, t_end - t_start)),
            "distance_m": distance,
            "mean_speed_kmh": float(chunk["speed_kmh"].mean()) if chunk["speed_kmh"].notna().any() else np.nan,
            "peak_speed_kmh": float(chunk["speed_kmh"].max()) if chunk["speed_kmh"].notna().any() else np.nan,
            "mean_accel_mps2": float(chunk["speed_accel_mps2"].mean()) if chunk["speed_accel_mps2"].notna().any() else np.nan,
            "peak_accel_mps2": float(chunk["speed_accel_mps2"].max()) if chunk["speed_accel_mps2"].notna().any() else np.nan,
            "min_accel_mps2": float(chunk["speed_accel_mps2"].min()) if chunk["speed_accel_mps2"].notna().any() else np.nan,
            "mean_effort": float(chunk["effort_score"].mean()),
            "peak_effort": float(chunk["effort_score"].max()),
            "peak_jerk_mps3": float(chunk["jerk_rms_mps3"].max()),
        }
    )


def weighted_z_sum(df: pd.DataFrame, weighted_columns: list[tuple[str, float]]) -> np.ndarray:
    acc = np.zeros(len(df), dtype=float)
    weight_sum = np.zeros(len(df), dtype=float)
    for col, weight in weighted_columns:
        if col not in df.columns:
            continue
        vals = df[col].to_numpy(dtype=float)
        good = np.isfinite(vals)
        if not np.any(good):
            continue
        acc[good] += weight * vals[good]
        weight_sum[good] += weight
    out = np.full(len(df), np.nan, dtype=float)
    good = weight_sum > 0
    out[good] = acc[good] / weight_sum[good]
    return out


def dominant_cadence_hz(signal: np.ndarray, fs: float, fmin: float = 1.2, fmax: float = 4.8) -> float:
    x = np.asarray(signal, dtype=float)
    x = x[np.isfinite(x)]
    if len(x) < max(32, int(fs)):
        return np.nan
    x = x - np.nanmedian(x)
    freqs, psd = welch(x, fs=fs, nperseg=min(len(x), max(64, int(fs * 2.0))))
    band = (freqs >= fmin) & (freqs <= fmax)
    if not np.any(band):
        return np.nan
    return float(freqs[band][np.argmax(psd[band])])


def load_motion(folder: Path) -> pd.DataFrame:
    accel = standardize_xyz(pd.read_csv(folder / "Accelerometer.csv"), "Accelerometer")
    gyro = standardize_xyz(pd.read_csv(folder / "Gyroscope.csv"), "Gyroscope")

    motion = accel[["seconds_elapsed", "x", "y", "z"]].rename(
        columns={"x": "acc_x", "y": "acc_y", "z": "acc_z"}
    )
    motion = pd.merge_asof(
        motion,
        gyro[["seconds_elapsed", "x", "y", "z"]].rename(columns={"x": "gyro_x", "y": "gyro_y", "z": "gyro_z"}),
        on="seconds_elapsed",
        direction="nearest",
        tolerance=0.02,
    )

    gravity_path = folder / "Gravity.csv"
    if gravity_path.exists() and gravity_path.stat().st_size > 0:
        gravity = standardize_xyz(pd.read_csv(gravity_path), "Gravity")
        motion = pd.merge_asof(
            motion,
            gravity[["seconds_elapsed", "x", "y", "z"]].rename(
                columns={"x": "grav_x", "y": "grav_y", "z": "grav_z"}
            ),
            on="seconds_elapsed",
            direction="nearest",
            tolerance=0.02,
        )
    else:
        motion["grav_x"] = 0.0
        motion["grav_y"] = 0.0
        motion["grav_z"] = 9.81

    orientation_path = folder / "Orientation.csv"
    if orientation_path.exists() and orientation_path.stat().st_size > 0:
        orientation = safe_seconds_elapsed(pd.read_csv(orientation_path))
        keep_cols = [c for c in ("seconds_elapsed", "yaw", "pitch", "roll") if c in orientation.columns]
        motion = pd.merge_asof(
            motion,
            orientation[keep_cols],
            on="seconds_elapsed",
            direction="nearest",
            tolerance=0.02,
        )

    motion = motion.dropna(subset=["gyro_x", "gyro_y", "gyro_z"]).reset_index(drop=True)
    dt = motion["seconds_elapsed"].diff().replace(0.0, np.nan)
    dt = dt.where(dt > 0.0)
    motion["dt"] = dt.fillna(np.nanmedian(dt))
    motion["dt"] = motion["dt"].clip(lower=1e-3)
    motion["fs"] = 1.0 / motion["dt"]

    acc_vec = motion[["acc_x", "acc_y", "acc_z"]].to_numpy(dtype=float)
    grav_vec = motion[["grav_x", "grav_y", "grav_z"]].to_numpy(dtype=float)
    grav_norm = np.linalg.norm(grav_vec, axis=1)
    grav_hat = np.divide(grav_vec, grav_norm[:, None], out=np.zeros_like(grav_vec), where=grav_norm[:, None] > 1e-6)

    motion["acc_mag_mps2"] = np.linalg.norm(acc_vec, axis=1)
    motion["gyro_mag_rads"] = np.linalg.norm(motion[["gyro_x", "gyro_y", "gyro_z"]].to_numpy(dtype=float), axis=1)
    motion["acc_vertical_mps2"] = np.sum(acc_vec * grav_hat, axis=1)
    horiz = acc_vec - motion["acc_vertical_mps2"].to_numpy(dtype=float)[:, None] * grav_hat
    motion["acc_horizontal_mps2"] = np.linalg.norm(horiz, axis=1)

    jerk = np.r_[0.0, np.diff(motion["acc_horizontal_mps2"]) / motion["dt"].iloc[1:].to_numpy(dtype=float)]
    motion["jerk_horizontal_mps3"] = np.clip(jerk, -4_000.0, 4_000.0)

    if {"yaw", "pitch", "roll"}.issubset(motion.columns):
        angles = motion[["yaw", "pitch", "roll"]].astype(float)
        unwrapped = np.unwrap(angles.to_numpy(), axis=0)
        ang_speed = np.r_[0.0, np.linalg.norm(np.diff(unwrapped, axis=0), axis=1)]
        motion["orientation_rate"] = ang_speed / motion["dt"].to_numpy(dtype=float)
    else:
        motion["orientation_rate"] = 0.0

    motion["acc_horizontal_smooth"] = motion["acc_horizontal_mps2"].rolling(9, center=True, min_periods=1).median()
    motion["acc_vertical_smooth"] = motion["acc_vertical_mps2"].rolling(9, center=True, min_periods=1).median()
    motion["gyro_mag_smooth"] = motion["gyro_mag_rads"].rolling(9, center=True, min_periods=1).median()
    return motion


def load_location(folder: Path, max_accuracy_m: float = 20.0, max_speed_mps: float = 12.5) -> pd.DataFrame:
    location_path = folder / "Location.csv"
    if not location_path.exists() or location_path.stat().st_size == 0:
        return pd.DataFrame(
            columns=[
                "seconds_elapsed",
                "latitude",
                "longitude",
                "speed_smooth_mps",
                "gps_distance_m",
                "horizontalAccuracy",
                "gps_ok",
                "route_ok",
            ]
        )

    location = safe_seconds_elapsed(pd.read_csv(location_path))
    for col in ("speed", "bearing", "speedAccuracy", "bearingAccuracy"):
        if col in location.columns:
            location[col] = location[col].replace(-1, np.nan)

    location["dt"] = location["seconds_elapsed"].diff().clip(lower=0.0)
    location["dt"] = location["dt"].fillna(0.0)
    coords_ok = location["latitude"].notna() & location["longitude"].notna()

    step_distance = haversine_step_distances(location["latitude"].to_numpy(), location["longitude"].to_numpy())
    step_distance[(location["dt"].to_numpy() < 0.5)] = 0.0
    location["step_distance_m"] = step_distance
    with np.errstate(divide="ignore", invalid="ignore"):
        location["derived_speed_mps"] = location["step_distance_m"] / location["dt"].replace(0.0, np.nan)

    speed_source = location["speed"] if "speed" in location.columns else np.nan
    location["speed_source_mps"] = speed_source.where(speed_source.notna(), location["derived_speed_mps"])
    location["gps_ok"] = coords_ok & (location["horizontalAccuracy"] <= max_accuracy_m) & (location["dt"] >= 0.5)
    if "speedAccuracy" in location.columns:
        location["gps_ok"] &= location["speedAccuracy"].fillna(2.5) <= 5.0
    location["speed_clean_mps"] = location["speed_source_mps"].where(location["gps_ok"])
    location["speed_clean_mps"] = location["speed_clean_mps"].where(location["speed_clean_mps"].between(0.0, max_speed_mps))
    location["speed_interp_mps"] = location["speed_clean_mps"].interpolate(limit_direction="both")
    location["speed_smooth_mps"] = (
        location["speed_interp_mps"].rolling(3, center=True, min_periods=1).median().fillna(0.0)
    )
    location["gps_distance_m"] = (location["speed_smooth_mps"] * location["dt"]).cumsum()
    with np.errstate(divide="ignore", invalid="ignore"):
        gps_accel = np.r_[0.0, np.diff(location["speed_smooth_mps"]) / location["dt"].iloc[1:].replace(0.0, np.nan)]
    location["gps_accel_mps2"] = pd.Series(gps_accel).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    route_limit = max(30.0, max_accuracy_m * 1.5)
    location["route_ok"] = coords_ok & (location["horizontalAccuracy"] <= route_limit)
    location["gps_quality_score"] = np.clip(100.0 * (1.0 - location["horizontalAccuracy"] / route_limit), 0.0, 100.0)
    return location


def compute_features(
    motion: pd.DataFrame,
    location: pd.DataFrame,
    win_s: float = 1.5,
    hop_s: float = 0.25,
) -> pd.DataFrame:
    dt = float(np.nanmedian(motion["dt"]))
    fs = 1.0 / dt
    win = max(32, int(round(win_s * fs)))
    hop = max(1, int(round(hop_s * fs)))

    rows: list[dict] = []
    for start in range(0, len(motion) - win + 1, hop):
        seg = motion.iloc[start : start + win]
        t_center = float(seg["seconds_elapsed"].iloc[len(seg) // 2])
        horiz = seg["acc_horizontal_mps2"].to_numpy(dtype=float)
        vert = seg["acc_vertical_mps2"].to_numpy(dtype=float)
        jerk = seg["jerk_horizontal_mps3"].to_numpy(dtype=float)
        rows.append(
            {
                "t_center": t_center,
                "horizontal_rms_mps2": float(np.sqrt(np.mean(horiz**2))),
                "vertical_rms_mps2": float(np.sqrt(np.mean(vert**2))),
                "impact_peak_mps2": float(np.nanpercentile(np.abs(vert), 95)),
                "jerk_rms_mps3": float(np.sqrt(np.mean(jerk**2))),
                "gyro_rms_rads": float(np.sqrt(np.mean(seg["gyro_mag_rads"].to_numpy(dtype=float) ** 2))),
                "orientation_rate_rads": float(
                    np.sqrt(np.mean(seg["orientation_rate"].to_numpy(dtype=float) ** 2))
                ),
                "cadence_hz": dominant_cadence_hz(vert, fs=fs),
            }
        )

    features = pd.DataFrame(rows)
    features["cadence_spm"] = features["cadence_hz"] * 60.0

    if not location.empty:
        gps_cols = [
            "seconds_elapsed",
            "speed_smooth_mps",
            "gps_distance_m",
            "horizontalAccuracy",
            "gps_accel_mps2",
            "gps_quality_score",
        ]
        gps = location[gps_cols].rename(columns={"seconds_elapsed": "t_center"})
        features = pd.merge_asof(
            features.sort_values("t_center"),
            gps.sort_values("t_center"),
            on="t_center",
            direction="nearest",
            tolerance=0.75,
        )
        features["speed_kmh"] = features["speed_smooth_mps"] * 3.6
    else:
        features["speed_smooth_mps"] = np.nan
        features["speed_kmh"] = np.nan
        features["gps_distance_m"] = np.nan
        features["horizontalAccuracy"] = np.nan
        features["gps_accel_mps2"] = np.nan
        features["gps_quality_score"] = np.nan

    features["feature_dt_s"] = features["t_center"].diff().fillna(0.0)
    if features["speed_smooth_mps"].notna().any():
        features["speed_phase_mps"] = (
            features["speed_smooth_mps"].interpolate(limit_direction="both").rolling(5, center=True, min_periods=1).mean()
        )
        if len(features) >= 3:
            features["speed_accel_mps2"] = np.gradient(
                features["speed_phase_mps"].to_numpy(dtype=float),
                features["t_center"].to_numpy(dtype=float),
            )
        else:
            features["speed_accel_mps2"] = 0.0
    else:
        features["speed_phase_mps"] = np.nan
        features["speed_accel_mps2"] = np.nan
    features["speed_accel_mps2"] = pd.Series(features["speed_accel_mps2"]).rolling(3, center=True, min_periods=1).mean()
    features["speed_phase_kmh"] = features["speed_phase_mps"] * 3.6

    for col in (
        "horizontal_rms_mps2",
        "impact_peak_mps2",
        "jerk_rms_mps3",
        "gyro_rms_rads",
        "orientation_rate_rads",
        "cadence_spm",
        "speed_smooth_mps",
        "gps_accel_mps2",
        "speed_accel_mps2",
    ):
        features[f"{col}_z"] = robust_z(features[col].to_numpy(dtype=float))

    features["effort_raw"] = weighted_z_sum(
        features,
        [
            ("horizontal_rms_mps2_z", 0.28),
            ("impact_peak_mps2_z", 0.15),
            ("jerk_rms_mps3_z", 0.24),
            ("gyro_rms_rads_z", 0.10),
            ("cadence_spm_z", 0.11),
            ("speed_smooth_mps_z", 0.12),
        ],
    )
    features["effort_score"] = normalize_score(features["effort_raw"].fillna(0.0))
    features["effort_score"] = pd.Series(features["effort_score"]).rolling(5, center=True, min_periods=1).mean()
    return features


def detect_sprints(features: pd.DataFrame, min_duration_s: float = 2.0) -> tuple[pd.DataFrame, pd.DataFrame]:
    if features.empty:
        return features.copy(), pd.DataFrame()

    features = features.copy()
    if features["speed_smooth_mps"].notna().any():
        speed_thr = max(float(features["speed_smooth_mps"].quantile(0.75)), 4.5)
        base_mask = features["speed_smooth_mps"].fillna(0.0) >= speed_thr
        effort_thr = float(features["effort_score"].quantile(0.65))
        base_mask &= features["effort_score"] >= effort_thr
    else:
        effort_thr = float(features["effort_score"].quantile(0.8))
        base_mask = features["effort_score"] >= effort_thr

    zones = merge_zones(features["t_center"], base_mask, min_duration_s=min_duration_s)
    features["sprint_id"] = np.nan
    sprint_rows = []
    for sprint_idx, (t_start, t_end) in enumerate(zones, start=1):
        mask = (features["t_center"] >= t_start) & (features["t_center"] <= t_end)
        sub = features.loc[mask].copy()
        if sub.empty:
            continue
        features.loc[mask, "sprint_id"] = sprint_idx
        peak_idx = sub["speed_smooth_mps"].fillna(-np.inf).idxmax()
        peak_time = float(features.loc[peak_idx, "t_center"])
        distance = np.nan
        if sub["gps_distance_m"].notna().any():
            distance = float(sub["gps_distance_m"].iloc[-1] - sub["gps_distance_m"].iloc[0])
        sprint_rows.append(
            {
                "sprint_id": sprint_idx,
                "t_start_s": float(t_start),
                "t_end_s": float(t_end),
                "duration_s": float(t_end - t_start),
                "distance_m": distance,
                "peak_speed_kmh": float(sub["speed_kmh"].max()) if sub["speed_kmh"].notna().any() else np.nan,
                "avg_speed_kmh": float(sub["speed_kmh"].mean()) if sub["speed_kmh"].notna().any() else np.nan,
                "peak_effort": float(sub["effort_score"].max()),
                "avg_effort": float(sub["effort_score"].mean()),
                "peak_cadence_spm": float(sub["cadence_spm"].max()) if sub["cadence_spm"].notna().any() else np.nan,
                "peak_impact_mps2": float(sub["impact_peak_mps2"].max()),
                "time_to_peak_speed_s": float(max(0.0, peak_time - t_start)),
            }
        )

    sprints = pd.DataFrame(sprint_rows)
    return features, sprints


def detect_bouts(features: pd.DataFrame, min_duration_s: float = 3.0) -> tuple[pd.DataFrame, pd.DataFrame]:
    if features.empty:
        return features.copy(), pd.DataFrame()

    features = features.copy()
    speed_ref = features["speed_phase_mps"].fillna(0.0)
    effort_ref = features["effort_score"].fillna(0.0)
    if features["speed_phase_mps"].notna().any():
        speed_thr = max(1.2, float(features["speed_phase_mps"].quantile(0.35)))
        move_mask = speed_ref >= speed_thr
        move_mask |= effort_ref >= max(45.0, float(features["effort_score"].quantile(0.55)))
    else:
        move_mask = effort_ref >= max(45.0, float(features["effort_score"].quantile(0.6)))

    bouts = []
    features["bout_id"] = np.nan
    for bout_id, (t_start, t_end) in enumerate(merge_zones(features["t_center"], move_mask, min_duration_s), start=1):
        mask = (features["t_center"] >= t_start) & (features["t_center"] <= t_end)
        sub = features.loc[mask].copy()
        if sub.empty:
            continue
        features.loc[mask, "bout_id"] = bout_id
        distance = np.nan
        if sub["gps_distance_m"].notna().any():
            distance = float(sub["gps_distance_m"].iloc[-1] - sub["gps_distance_m"].iloc[0])
        bouts.append(
            {
                "bout_id": bout_id,
                "t_start_s": float(t_start),
                "t_end_s": float(t_end),
                "duration_s": float(t_end - t_start),
                "distance_m": distance,
                "peak_speed_kmh": float(sub["speed_kmh"].max()) if sub["speed_kmh"].notna().any() else np.nan,
                "avg_speed_kmh": float(sub["speed_kmh"].mean()) if sub["speed_kmh"].notna().any() else np.nan,
                "peak_effort": float(sub["effort_score"].max()),
                "avg_effort": float(sub["effort_score"].mean()),
            }
        )
    return features, pd.DataFrame(bouts)


def detect_phases(features: pd.DataFrame, bouts: pd.DataFrame, sprints: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    features = features.copy()
    features["phase"] = np.where(features["bout_id"].notna(), "movimiento", "reposo")
    phase_rows: list[dict] = []
    sprints = sprints.copy()

    for bout in bouts.itertuples(index=False):
        bout_mask = features["bout_id"] == bout.bout_id
        bout_core = features.loc[bout_mask].copy()
        if bout_core.empty:
            continue

        sprint_id = np.nan
        sprint_row = None
        if not sprints.empty:
            sprint_match = sprints[
                (sprints["t_start_s"] <= bout.t_end_s + 0.5) & (sprints["t_end_s"] >= bout.t_start_s - 0.5)
            ]
            if not sprint_match.empty:
                sprint_id = float(sprint_match.iloc[0]["sprint_id"])
                sprint_row = sprint_match.iloc[0]

        window_start = bout.t_start_s - 2.0
        window_end = bout.t_end_s + 3.0
        if sprint_row is not None:
            window_start = min(window_start, float(sprint_row["t_start_s"]) - 2.0)
            window_end = max(window_end, float(sprint_row["t_end_s"]) + 3.0)
        sub = features[(features["t_center"] >= window_start) & (features["t_center"] <= window_end)].copy().reset_index()
        if sub.empty:
            continue

        speeds = sub["speed_phase_mps"].fillna(sub["speed_smooth_mps"]).fillna(0.0).to_numpy(dtype=float)
        accels = sub["speed_accel_mps2"].fillna(0.0).to_numpy(dtype=float)
        jerks = sub["jerk_rms_mps3"].fillna(0.0).to_numpy(dtype=float)
        times = sub["t_center"].to_numpy(dtype=float)

        peak_idx = int(np.nanargmax(speeds))
        peak_speed = float(np.nanmax(speeds))
        if not np.isfinite(peak_speed) or peak_speed <= 0.0:
            features.loc[features.index[sub["index"]], "phase"] = "movimiento"
            add_phase_rows(phase_rows, int(bout.bout_id), sprint_id, "movimiento", sub, 0, len(sub) - 1)
            continue

        pre_candidates = np.flatnonzero(
            (times <= bout.t_start_s) & (speeds <= max(1.0, 0.25 * peak_speed))
        )
        start_trim = int(pre_candidates[-1]) if len(pre_candidates) else 0
        post_candidates = np.flatnonzero(
            (times >= bout.t_end_s) & (speeds <= max(1.0, 0.35 * peak_speed))
        )
        end_trim = int(post_candidates[0]) if len(post_candidates) else len(sub) - 1
        sub = sub.iloc[start_trim : end_trim + 1].copy().reset_index(drop=True)
        speeds = sub["speed_phase_mps"].fillna(sub["speed_smooth_mps"]).fillna(0.0).to_numpy(dtype=float)
        accels = sub["speed_accel_mps2"].fillna(0.0).to_numpy(dtype=float)
        jerks = sub["jerk_rms_mps3"].fillna(0.0).to_numpy(dtype=float)
        times = sub["t_center"].to_numpy(dtype=float)
        peak_idx = int(np.nanargmax(speeds))
        peak_speed = float(np.nanmax(speeds))
        features.loc[features.index[sub["index"]], "bout_id"] = bout.bout_id

        reach_35 = first_index_where(speeds >= max(0.8, 0.35 * peak_speed))
        reach_50 = first_index_where(speeds >= max(1.0, 0.50 * peak_speed))
        reach_90 = first_index_where(speeds >= 0.90 * peak_speed)
        if reach_35 is None:
            reach_35 = min(peak_idx, max(0, len(sub) - 1))
        if reach_50 is None:
            reach_50 = min(peak_idx, max(0, len(sub) - 1))
        if reach_90 is None:
            reach_90 = peak_idx

        plateau_start = min(max(reach_90, peak_idx), len(sub) - 1)
        decel_candidates = np.flatnonzero(
            (np.arange(len(sub)) > plateau_start) & ((speeds < 0.92 * peak_speed) | (accels <= -0.35))
        )
        if len(decel_candidates):
            decel_start = int(decel_candidates[0])
            plateau_end = max(plateau_start, decel_start - 1)
        else:
            decel_start = None
            plateau_end = len(sub) - 1

        stop_candidates = np.flatnonzero(
            (np.arange(len(sub)) > (decel_start if decel_start is not None else plateau_end))
            & (speeds <= max(1.0, 0.35 * peak_speed))
        )
        stop_start = int(stop_candidates[0]) if len(stop_candidates) else None

        phase_ranges = [
            ("partida", 0, reach_35 - 1 if reach_35 > 0 else None),
            ("aceleracion", reach_35, reach_90 - 1 if reach_90 > reach_35 else peak_idx),
            ("meseta", plateau_start, plateau_end if plateau_end >= plateau_start else None),
            (
                "bajada_ritmo",
                decel_start,
                (stop_start - 1) if (decel_start is not None and stop_start is not None and stop_start > decel_start) else (
                    len(sub) - 1 if decel_start is not None else None
                ),
            ),
            ("detencion", stop_start, len(sub) - 1 if stop_start is not None else None),
        ]

        assigned = np.zeros(len(sub), dtype=bool)
        phase_order = []
        for phase_name, start_idx, end_idx in phase_ranges:
            if start_idx is None or end_idx is None or end_idx < start_idx:
                continue
            phase_order.append(phase_name)
            assigned[start_idx : end_idx + 1] = True
            features.loc[features.index[sub.loc[start_idx : end_idx, "index"]], "phase"] = phase_name
            add_phase_rows(phase_rows, int(bout.bout_id), sprint_id, phase_name, sub, start_idx, end_idx)

        if not np.all(assigned):
            for idx in np.flatnonzero(~assigned):
                features.loc[features.index[sub.loc[idx, "index"]], "phase"] = "transicion"
            trans_start = None
            for idx, pending in enumerate(~assigned):
                if pending and trans_start is None:
                    trans_start = idx
                if trans_start is not None and ((not pending) or idx == len(sub) - 1):
                    trans_end = idx if pending and idx == len(sub) - 1 else idx - 1
                    add_phase_rows(phase_rows, int(bout.bout_id), sprint_id, "transicion", sub, trans_start, trans_end)
                    trans_start = None

        launch = sub.iloc[: reach_90 + 1].copy()
        if not launch.empty:
            time_to_35 = float(max(0.0, times[reach_35] - times[0]))
            time_to_50 = float(max(0.0, times[reach_50] - times[0]))
            time_to_90 = float(max(0.0, times[reach_90] - times[0]))
            launch_peak_accel = float(np.nanmax(accels[: reach_90 + 1]))
            launch_mean_accel = float(np.nanmean(np.clip(accels[: reach_90 + 1], 0.0, None)))
            launch_peak_jerk = float(np.nanmax(jerks[: reach_90 + 1]))
        else:
            time_to_35 = np.nan
            time_to_50 = np.nan
            time_to_90 = np.nan
            launch_peak_accel = np.nan
            launch_mean_accel = np.nan
            launch_peak_jerk = np.nan

        decel_peak = float(np.nanmin(accels[decel_start:])) if decel_start is not None else np.nan
        plateau_duration = 0.0 if plateau_end < plateau_start else float(times[plateau_end] - times[plateau_start])
        decel_duration = (
            float(times[(stop_start - 1) if stop_start is not None and stop_start > decel_start else -1] - times[decel_start])
            if decel_start is not None
            else 0.0
        )
        stop_duration = float(times[-1] - times[stop_start]) if stop_start is not None else 0.0

        bouts.loc[bouts["bout_id"] == bout.bout_id, "time_to_35pct_peak_s"] = time_to_35
        bouts.loc[bouts["bout_id"] == bout.bout_id, "time_to_50pct_peak_s"] = time_to_50
        bouts.loc[bouts["bout_id"] == bout.bout_id, "time_to_90pct_peak_s"] = time_to_90
        bouts.loc[bouts["bout_id"] == bout.bout_id, "launch_peak_accel_mps2"] = launch_peak_accel
        bouts.loc[bouts["bout_id"] == bout.bout_id, "launch_mean_accel_mps2"] = launch_mean_accel
        bouts.loc[bouts["bout_id"] == bout.bout_id, "launch_peak_jerk_mps3"] = launch_peak_jerk
        bouts.loc[bouts["bout_id"] == bout.bout_id, "plateau_duration_s"] = plateau_duration
        bouts.loc[bouts["bout_id"] == bout.bout_id, "decel_duration_s"] = decel_duration
        bouts.loc[bouts["bout_id"] == bout.bout_id, "stop_duration_s"] = stop_duration
        bouts.loc[bouts["bout_id"] == bout.bout_id, "decel_peak_mps2"] = decel_peak
        bouts.loc[bouts["bout_id"] == bout.bout_id, "phase_sequence"] = " > ".join(phase_order)

        if pd.notna(sprint_id):
            sprints.loc[sprints["sprint_id"] == sprint_id, "bout_id"] = int(bout.bout_id)
            sprints.loc[sprints["sprint_id"] == sprint_id, "time_to_35pct_peak_s"] = time_to_35
            sprints.loc[sprints["sprint_id"] == sprint_id, "time_to_50pct_peak_s"] = time_to_50
            sprints.loc[sprints["sprint_id"] == sprint_id, "time_to_90pct_peak_s"] = time_to_90
            sprints.loc[sprints["sprint_id"] == sprint_id, "launch_peak_accel_mps2"] = launch_peak_accel
            sprints.loc[sprints["sprint_id"] == sprint_id, "launch_mean_accel_mps2"] = launch_mean_accel
            sprints.loc[sprints["sprint_id"] == sprint_id, "launch_peak_jerk_mps3"] = launch_peak_jerk
            sprints.loc[sprints["sprint_id"] == sprint_id, "plateau_duration_s"] = plateau_duration
            sprints.loc[sprints["sprint_id"] == sprint_id, "decel_duration_s"] = decel_duration
            sprints.loc[sprints["sprint_id"] == sprint_id, "stop_duration_s"] = stop_duration
            sprints.loc[sprints["sprint_id"] == sprint_id, "decel_peak_mps2"] = decel_peak
            sprints.loc[sprints["sprint_id"] == sprint_id, "phase_sequence"] = " > ".join(phase_order)

    phases = pd.DataFrame(phase_rows)
    return features, phases, sprints


def rolling_best_speed(location: pd.DataFrame, window_s: int) -> float:
    if location.empty or "speed_smooth_mps" not in location.columns:
        return np.nan
    approx_hz = max(1, int(round(1.0 / np.nanmedian(location["dt"].replace(0.0, np.nan).dropna()))))
    window = max(1, int(round(window_s * approx_hz)))
    return float(location["speed_smooth_mps"].rolling(window, min_periods=1).mean().max() * 3.6)


def build_summary(
    motion: pd.DataFrame,
    location: pd.DataFrame,
    features: pd.DataFrame,
    bouts: pd.DataFrame,
    phases: pd.DataFrame,
    sprints: pd.DataFrame,
) -> tuple[dict, pd.DataFrame]:
    duration_s = float(motion["seconds_elapsed"].iloc[-1] - motion["seconds_elapsed"].iloc[0])
    distance_m = float(location["gps_distance_m"].iloc[-1]) if not location.empty else np.nan
    moving_time_s = (
        float(location.loc[location["speed_smooth_mps"] >= 1.0, "dt"].sum()) if not location.empty else np.nan
    )
    moving_avg_kmh = np.nan
    if not location.empty and moving_time_s and moving_time_s > 0:
        moving_distance = float((location["speed_smooth_mps"] * location["dt"]).where(location["speed_smooth_mps"] >= 1.0).sum())
        moving_avg_kmh = 3.6 * moving_distance / moving_time_s

    best_sprint = sprints.sort_values(["peak_speed_kmh", "peak_effort"], ascending=False).head(1)
    summary = {
        "duration_s": duration_s,
        "distance_m": distance_m,
        "moving_time_s": moving_time_s,
        "moving_avg_speed_kmh": moving_avg_kmh,
        "peak_speed_kmh": float(features["speed_kmh"].max()) if features["speed_kmh"].notna().any() else np.nan,
        "best_3s_speed_kmh": rolling_best_speed(location, 3),
        "best_5s_speed_kmh": rolling_best_speed(location, 5),
        "peak_effort_score": float(features["effort_score"].max()),
        "mean_effort_score": float(features["effort_score"].mean()),
        "peak_cadence_spm": float(features["cadence_spm"].max()) if features["cadence_spm"].notna().any() else np.nan,
        "peak_impact_mps2": float(features["impact_peak_mps2"].max()),
        "peak_jerk_mps3": float(features["jerk_rms_mps3"].max()),
        "gps_quality_pct": float(location["gps_ok"].mean() * 100.0) if not location.empty else np.nan,
        "gps_accuracy_median_m": float(location["horizontalAccuracy"].median()) if not location.empty else np.nan,
        "n_bouts": int(len(bouts)),
        "n_phases": int(len(phases)),
        "n_sprints": int(len(sprints)),
    }
    if not best_sprint.empty:
        row = best_sprint.iloc[0]
        summary["best_sprint_peak_kmh"] = float(row["peak_speed_kmh"])
        summary["best_sprint_distance_m"] = float(row["distance_m"]) if pd.notna(row["distance_m"]) else np.nan
        summary["best_sprint_duration_s"] = float(row["duration_s"])
        summary["best_sprint_time_to_peak_s"] = float(row["time_to_peak_speed_s"])
        summary["best_sprint_time_to_50pct_peak_s"] = float(row["time_to_50pct_peak_s"]) if "time_to_50pct_peak_s" in row else np.nan
        summary["best_sprint_time_to_90pct_peak_s"] = float(row["time_to_90pct_peak_s"]) if "time_to_90pct_peak_s" in row else np.nan
        summary["best_sprint_launch_peak_accel_mps2"] = float(row["launch_peak_accel_mps2"]) if "launch_peak_accel_mps2" in row else np.nan
        summary["best_sprint_launch_mean_accel_mps2"] = float(row["launch_mean_accel_mps2"]) if "launch_mean_accel_mps2" in row else np.nan
        summary["best_sprint_launch_peak_jerk_mps3"] = float(row["launch_peak_jerk_mps3"]) if "launch_peak_jerk_mps3" in row else np.nan
        summary["best_sprint_plateau_duration_s"] = float(row["plateau_duration_s"]) if "plateau_duration_s" in row else np.nan
        summary["best_sprint_decel_duration_s"] = float(row["decel_duration_s"]) if "decel_duration_s" in row else np.nan
        summary["best_sprint_stop_duration_s"] = float(row["stop_duration_s"]) if "stop_duration_s" in row else np.nan
    else:
        summary["best_sprint_peak_kmh"] = np.nan
        summary["best_sprint_distance_m"] = np.nan
        summary["best_sprint_duration_s"] = np.nan
        summary["best_sprint_time_to_peak_s"] = np.nan
        summary["best_sprint_time_to_50pct_peak_s"] = np.nan
        summary["best_sprint_time_to_90pct_peak_s"] = np.nan
        summary["best_sprint_launch_peak_accel_mps2"] = np.nan
        summary["best_sprint_launch_mean_accel_mps2"] = np.nan
        summary["best_sprint_launch_peak_jerk_mps3"] = np.nan
        summary["best_sprint_plateau_duration_s"] = np.nan
        summary["best_sprint_decel_duration_s"] = np.nan
        summary["best_sprint_stop_duration_s"] = np.nan

    rows = [
        ("Duracion", summary["duration_s"], "s"),
        ("Distancia GPS", summary["distance_m"], "m"),
        ("Tiempo en movimiento", summary["moving_time_s"], "s"),
        ("Velocidad media en movimiento", summary["moving_avg_speed_kmh"], "km/h"),
        ("Velocidad pico", summary["peak_speed_kmh"], "km/h"),
        ("Mejor media 3 s", summary["best_3s_speed_kmh"], "km/h"),
        ("Mejor media 5 s", summary["best_5s_speed_kmh"], "km/h"),
        ("Pico de esfuerzo", summary["peak_effort_score"], "/100"),
        ("Esfuerzo medio", summary["mean_effort_score"], "/100"),
        ("Cadencia pico", summary["peak_cadence_spm"], "spm"),
        ("Impacto pico", summary["peak_impact_mps2"], "m/s2"),
        ("Jerk pico", summary["peak_jerk_mps3"], "m/s3"),
        ("Cobertura GPS util", summary["gps_quality_pct"], "%"),
        ("Precision GPS mediana", summary["gps_accuracy_median_m"], "m"),
        ("Cantidad de bouts", summary["n_bouts"], ""),
        ("Cantidad de fases", summary["n_phases"], ""),
        ("Cantidad de sprints", summary["n_sprints"], ""),
        ("Mejor sprint velocidad", summary["best_sprint_peak_kmh"], "km/h"),
        ("Mejor sprint distancia", summary["best_sprint_distance_m"], "m"),
        ("Mejor sprint duracion", summary["best_sprint_duration_s"], "s"),
        ("Mejor sprint tiempo a vmax", summary["best_sprint_time_to_peak_s"], "s"),
        ("Mejor sprint tiempo a 50%", summary["best_sprint_time_to_50pct_peak_s"], "s"),
        ("Mejor sprint tiempo a 90%", summary["best_sprint_time_to_90pct_peak_s"], "s"),
        ("Mejor sprint acel max partida", summary["best_sprint_launch_peak_accel_mps2"], "m/s2"),
        ("Mejor sprint acel media partida", summary["best_sprint_launch_mean_accel_mps2"], "m/s2"),
        ("Mejor sprint jerk max partida", summary["best_sprint_launch_peak_jerk_mps3"], "m/s3"),
        ("Mejor sprint duracion meseta", summary["best_sprint_plateau_duration_s"], "s"),
        ("Mejor sprint duracion bajada", summary["best_sprint_decel_duration_s"], "s"),
        ("Mejor sprint duracion detencion", summary["best_sprint_stop_duration_s"], "s"),
    ]
    summary_table = pd.DataFrame(rows, columns=["metric", "value", "unit"])
    return summary, summary_table


def build_playback_track(features: pd.DataFrame, location: pd.DataFrame) -> pd.DataFrame:
    playback = features[["t_center", "effort_score", "speed_kmh", "cadence_spm", "phase", "sprint_id", "bout_id"]].copy()
    if location.empty or not location["route_ok"].any():
        playback["latitude"] = np.nan
        playback["longitude"] = np.nan
        playback["gps_distance_m"] = features["gps_distance_m"]
        return playback

    route = location.loc[location["route_ok"], ["seconds_elapsed", "latitude", "longitude", "gps_distance_m"]].copy()
    route = route.drop_duplicates(subset="seconds_elapsed").sort_values("seconds_elapsed")
    if len(route) < 2:
        playback["latitude"] = route["latitude"].iloc[0] if len(route) else np.nan
        playback["longitude"] = route["longitude"].iloc[0] if len(route) else np.nan
        playback["gps_distance_m"] = features["gps_distance_m"]
        return playback

    t_route = route["seconds_elapsed"].to_numpy(dtype=float)
    playback["latitude"] = np.interp(playback["t_center"], t_route, route["latitude"])
    playback["longitude"] = np.interp(playback["t_center"], t_route, route["longitude"])
    playback["gps_distance_m"] = np.interp(playback["t_center"], t_route, route["gps_distance_m"])
    return playback


def load_running_analysis(
    folder: str | Path,
    win_s: float = 1.5,
    hop_s: float = 0.25,
    max_accuracy_m: float = 20.0,
    max_speed_mps: float = 12.5,
    sprint_min_duration_s: float = 2.0,
) -> RunningAnalysis:
    base_folder = resolve_input_path(folder).resolve()
    motion = load_motion(base_folder)
    location = load_location(base_folder, max_accuracy_m=max_accuracy_m, max_speed_mps=max_speed_mps)
    features = compute_features(motion, location, win_s=win_s, hop_s=hop_s)
    features, bouts = detect_bouts(features)
    features, sprints = detect_sprints(features, min_duration_s=sprint_min_duration_s)
    features, phases, sprints = detect_phases(features, bouts, sprints)
    summary, summary_table = build_summary(motion, location, features, bouts, phases, sprints)
    playback = build_playback_track(features, location)
    return RunningAnalysis(
        folder=base_folder,
        motion=motion,
        location=location,
        features=features,
        bouts=bouts,
        phases=phases,
        sprints=sprints,
        playback=playback,
        summary=summary,
        summary_table=summary_table,
    )


def export_running_analysis(analysis: RunningAnalysis, export_dir: str | Path | None = None) -> Path:
    if export_dir is None:
        export_dir = analysis.folder / "running_analysis_exports"
    out_dir = Path(export_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    analysis.summary_table.to_csv(out_dir / "summary.csv", index=False)
    analysis.features.to_csv(out_dir / "features.csv", index=False)
    analysis.bouts.to_csv(out_dir / "bouts.csv", index=False)
    analysis.phases.to_csv(out_dir / "phases.csv", index=False)
    analysis.sprints.to_csv(out_dir / "sprints.csv", index=False)
    analysis.playback.to_csv(out_dir / "playback_track.csv", index=False)
    if not analysis.location.empty:
        analysis.location.to_csv(out_dir / "location_clean.csv", index=False)
    return out_dir
