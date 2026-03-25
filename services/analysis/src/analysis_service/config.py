from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    app_name: str = "running-analysis-service"
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    analysis_api_token: str = "change-me"

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_storage_bucket: str = "session-zips"
    supabase_exports_bucket: str = "session-exports"

    redis_url: str = "redis://redis:6379/0"
    redis_queue_name: str = "analysis:jobs"

    work_root: Path = Path("/tmp/running-analysis")
    max_zip_size_mb: int = 512


settings = Settings()
