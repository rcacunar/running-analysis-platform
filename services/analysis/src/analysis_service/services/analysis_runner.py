from __future__ import annotations

import shutil
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from analysis_service.config import settings
from analysis_service.core import export_running_analysis, load_running_analysis
from analysis_service.services.session_store import (
    download_storage_file,
    fetch_session,
    replace_rows,
    save_exports,
    save_summary,
    storage_public_meta,
    update_session_status,
    upload_storage_file,
)


REQUIRED_FILES = {"Accelerometer.csv", "Gyroscope.csv"}


def detect_session_folder(root: Path) -> Path:
    file_names = {p.name for p in root.glob("*.csv")} | {p.name for p in root.glob("*.CSV")}
    if REQUIRED_FILES.issubset(file_names):
        return root
    candidates = []
    for path in root.rglob("*"):
        if not path.is_dir():
            continue
        names = {p.name for p in path.iterdir() if p.is_file()}
        if REQUIRED_FILES.issubset(names):
            candidates.append(path)
    if not candidates:
        raise RuntimeError("No valid session folder found in uploaded ZIP")
    candidates.sort(key=lambda p: (len(p.parts), str(p)))
    return candidates[0]


def _clean_records(df: pd.DataFrame, session_id: str) -> list[dict]:
    if df.empty:
        return []
    safe = df.where(pd.notnull(df), None).copy()
    safe.insert(0, "session_id", session_id)
    return safe.to_dict(orient="records")


def process_session(session_id: str) -> dict:
    session = fetch_session(session_id)
    now = datetime.now(timezone.utc).isoformat()
    update_session_status(session_id, "processing", started_at=now)

    workdir = Path(tempfile.mkdtemp(prefix=f"running-session-{session_id}-", dir=str(settings.work_root)))
    try:
        raw_zip = download_storage_file(
            session["upload_bucket"],
            session["upload_path"],
            workdir / "input" / "session.zip",
        )
        extract_dir = workdir / "unzipped"
        with zipfile.ZipFile(raw_zip) as zf:
            zf.extractall(extract_dir)

        session_folder = detect_session_folder(extract_dir)
        analysis = load_running_analysis(session_folder)
        export_dir = export_running_analysis(analysis, export_dir=workdir / "exports")

        save_summary(
            session_id,
            {
                "duration_s": analysis.summary.get("duration_s"),
                "distance_m": analysis.summary.get("distance_m"),
                "moving_time_s": analysis.summary.get("moving_time_s"),
                "moving_avg_speed_kmh": analysis.summary.get("moving_avg_speed_kmh"),
                "peak_speed_kmh": analysis.summary.get("peak_speed_kmh"),
                "best_3s_speed_kmh": analysis.summary.get("best_3s_speed_kmh"),
                "best_5s_speed_kmh": analysis.summary.get("best_5s_speed_kmh"),
                "peak_effort_score": analysis.summary.get("peak_effort_score"),
                "mean_effort_score": analysis.summary.get("mean_effort_score"),
                "peak_cadence_spm": analysis.summary.get("peak_cadence_spm"),
                "peak_impact_mps2": analysis.summary.get("peak_impact_mps2"),
                "peak_jerk_mps3": analysis.summary.get("peak_jerk_mps3"),
                "gps_quality_pct": analysis.summary.get("gps_quality_pct"),
                "gps_accuracy_median_m": analysis.summary.get("gps_accuracy_median_m"),
                "n_bouts": analysis.summary.get("n_bouts"),
                "n_phases": analysis.summary.get("n_phases"),
                "n_sprints": analysis.summary.get("n_sprints"),
                "best_sprint_peak_kmh": analysis.summary.get("best_sprint_peak_kmh"),
                "best_sprint_distance_m": analysis.summary.get("best_sprint_distance_m"),
                "best_sprint_duration_s": analysis.summary.get("best_sprint_duration_s"),
                "best_sprint_time_to_peak_s": analysis.summary.get("best_sprint_time_to_peak_s"),
                "best_sprint_time_to_50pct_peak_s": analysis.summary.get("best_sprint_time_to_50pct_peak_s"),
                "best_sprint_time_to_90pct_peak_s": analysis.summary.get("best_sprint_time_to_90pct_peak_s"),
                "best_sprint_launch_peak_accel_mps2": analysis.summary.get("best_sprint_launch_peak_accel_mps2"),
                "best_sprint_launch_mean_accel_mps2": analysis.summary.get("best_sprint_launch_mean_accel_mps2"),
                "best_sprint_launch_peak_jerk_mps3": analysis.summary.get("best_sprint_launch_peak_jerk_mps3"),
                "best_sprint_plateau_duration_s": analysis.summary.get("best_sprint_plateau_duration_s"),
                "best_sprint_decel_duration_s": analysis.summary.get("best_sprint_decel_duration_s"),
                "best_sprint_stop_duration_s": analysis.summary.get("best_sprint_stop_duration_s"),
                "best_sprint_phase_sequence": (
                    analysis.sprints.iloc[0]["phase_sequence"] if not analysis.sprints.empty else None
                ),
            },
        )

        replace_rows("session_sprints", session_id, _clean_records(analysis.sprints, session_id))
        replace_rows("session_bouts", session_id, _clean_records(analysis.bouts, session_id))
        replace_rows("session_phases", session_id, _clean_records(analysis.phases, session_id))
        replace_rows("session_playback_points", session_id, _clean_records(analysis.playback, session_id))
        feature_subset = analysis.features[
            [
                "t_center",
                "speed_kmh",
                "effort_score",
                "cadence_spm",
                "speed_accel_mps2",
                "impact_peak_mps2",
                "jerk_rms_mps3",
                "phase",
                "sprint_id",
                "bout_id",
            ]
        ].copy()
        replace_rows("session_feature_points", session_id, _clean_records(feature_subset, session_id))

        export_rows: list[dict] = []
        for file_path in export_dir.iterdir():
            if not file_path.is_file():
                continue
            storage_path = f"{session['user_id']}/{session_id}/{file_path.name}"
            content_type = "text/csv" if file_path.suffix.lower() == ".csv" else "application/octet-stream"
            upload_storage_file(settings.supabase_exports_bucket, storage_path, file_path, content_type=content_type)
            export_rows.append(
                {
                    "session_id": session_id,
                    "kind": file_path.stem,
                    "bucket": settings.supabase_exports_bucket,
                    "storage_path": storage_path,
                    "mime_type": content_type,
                    "file_size_bytes": file_path.stat().st_size,
                }
            )
        save_exports(session_id, export_rows)

        update_session_status(
            session_id,
            "completed",
            finished_at=datetime.now(timezone.utc).isoformat(),
            analysis_version="v1",
            error_message=None,
        )
        return {
            "session_id": session_id,
            "summary": analysis.summary,
            "exports": [storage_public_meta(row["bucket"], row["storage_path"]) for row in export_rows],
        }
    except Exception as exc:
        update_session_status(
            session_id,
            "failed",
            finished_at=datetime.now(timezone.utc).isoformat(),
            error_message=str(exc),
        )
        raise
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
