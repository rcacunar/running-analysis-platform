from __future__ import annotations

from pathlib import Path

from analysis_service.config import settings
from analysis_service.services.supabase_client import get_service_supabase


def _table(name: str):
    return get_service_supabase().table(name)


def fetch_session(session_id: str) -> dict:
    data = (
        _table("sessions")
        .select("*")
        .eq("id", session_id)
        .limit(1)
        .execute()
    )
    if not data.data:
        raise RuntimeError(f"Session {session_id} not found")
    return data.data[0]


def update_session_status(session_id: str, status: str, **fields) -> None:
    payload = {"status": status, **fields}
    _table("sessions").update(payload).eq("id", session_id).execute()


def replace_rows(table: str, session_id: str, rows: list[dict]) -> None:
    _table(table).delete().eq("session_id", session_id).execute()
    if rows:
        _table(table).insert(rows).execute()


def save_summary(session_id: str, summary: dict) -> None:
    payload = {"session_id": session_id, **summary}
    _table("session_summaries").upsert(payload).execute()


def save_exports(session_id: str, rows: list[dict]) -> None:
    replace_rows("session_exports", session_id, rows)


def download_storage_file(bucket: str, storage_path: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    data = get_service_supabase().storage.from_(bucket).download(storage_path)
    destination.write_bytes(data)
    return destination


def upload_storage_file(bucket: str, storage_path: str, file_path: Path, content_type: str = "text/csv") -> None:
    with file_path.open("rb") as handle:
        get_service_supabase().storage.from_(bucket).upload(
            storage_path,
            handle,
            file_options={"content-type": content_type, "upsert": True},
        )


def storage_public_meta(bucket: str, path: str) -> dict:
    return {"bucket": bucket, "path": path}
