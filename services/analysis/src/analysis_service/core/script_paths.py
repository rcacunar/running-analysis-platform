#!/usr/bin/env python3
import hashlib
import tempfile
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent


def resolve_input_path(file_path: str | Path, folder: str | Path | None = None) -> Path:
    path = Path(file_path).expanduser()
    if path.is_absolute():
        return path
    if folder is not None:
        folder_path = Path(folder).expanduser()
        if not folder_path.is_absolute():
            folder_path = (Path.cwd() / folder_path).resolve()
        return folder_path / path
    cwd_candidate = (Path.cwd() / path).resolve()
    if cwd_candidate.exists():
        return cwd_candidate
    script_candidate = SCRIPT_DIR / path
    if script_candidate.exists():
        return script_candidate
    return cwd_candidate


def temp_audio_wav_path(source_path: str | Path) -> Path:
    source = Path(source_path).expanduser().resolve()
    digest = hashlib.sha1(str(source).encode("utf-8")).hexdigest()[:12]
    return Path(tempfile.gettempdir()) / f"{source.stem}_{digest}_ffmpeg.wav"
