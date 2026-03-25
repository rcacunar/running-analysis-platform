from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from analysis_service.config import settings


@lru_cache(maxsize=1)
def get_service_supabase() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
