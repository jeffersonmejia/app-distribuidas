from __future__ import annotations

import sys
from pathlib import Path

SYNC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SYNC_DIR))

