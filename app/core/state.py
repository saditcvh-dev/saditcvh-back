# app/core/state.py
from typing import Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

pdf_storage: Dict[str, Dict[str, Any]] = {}
pdf_task_status: Dict[str, Dict[str, Any]] = {}

def reset_state():
    global pdf_storage, pdf_task_status
    pdf_storage.clear()
    pdf_task_status.clear()
    logger.info("Estado global de PDFs reiniciado")