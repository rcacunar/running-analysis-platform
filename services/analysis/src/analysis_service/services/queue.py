from __future__ import annotations

import json

from redis import Redis

from analysis_service.config import settings


def get_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def enqueue_analysis_job(session_id: str) -> None:
    payload = json.dumps({"session_id": session_id})
    get_redis().lpush(settings.redis_queue_name, payload)


def dequeue_analysis_job(timeout_s: int = 5) -> dict | None:
    item = get_redis().brpop(settings.redis_queue_name, timeout=timeout_s)
    if not item:
        return None
    _, payload = item
    return json.loads(payload)
