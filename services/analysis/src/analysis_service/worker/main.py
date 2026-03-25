from __future__ import annotations

import logging
import time

from analysis_service.config import settings
from analysis_service.services.analysis_runner import process_session
from analysis_service.services.queue import dequeue_analysis_job


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("analysis-worker")


def run() -> None:
    settings.work_root.mkdir(parents=True, exist_ok=True)
    logger.info("worker started queue=%s", settings.redis_queue_name)
    while True:
        job = dequeue_analysis_job(timeout_s=5)
        if not job:
            continue
        session_id = job["session_id"]
        logger.info("processing session_id=%s", session_id)
        try:
            process_session(session_id)
            logger.info("completed session_id=%s", session_id)
        except Exception:
            logger.exception("failed session_id=%s", session_id)
            time.sleep(1)


if __name__ == "__main__":
    run()
