import json
import sqlite3
from pathlib import Path

from app.models.analysis import AnalysisResult


class AnalysisRepository:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def init(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS analyses (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    sequence_name TEXT NOT NULL,
                    sequence_type TEXT NOT NULL,
                    confidence_score INTEGER NOT NULL,
                    candidate_source TEXT NOT NULL,
                    payload TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def save(self, analysis: AnalysisResult) -> None:
        payload = analysis.model_dump_json()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO analyses
                (id, created_at, status, sequence_name, sequence_type, confidence_score, candidate_source, payload)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    analysis.id,
                    analysis.created_at.isoformat(),
                    analysis.status,
                    analysis.sequence.name,
                    analysis.sequence.sequence_type,
                    analysis.fusion.confidence_score,
                    analysis.fusion.candidate_source,
                    payload,
                ),
            )
            conn.commit()

    def get(self, analysis_id: str) -> AnalysisResult | None:
        with self._connect() as conn:
            row = conn.execute("SELECT payload FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
        if not row:
            return None
        return AnalysisResult.model_validate_json(row["payload"])

    def list_recent(self, limit: int = 20) -> list[dict[str, object]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, created_at, status, sequence_name, sequence_type, confidence_score, candidate_source
                FROM analyses
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    def stats(self) -> dict[str, object]:
        with self._connect() as conn:
            count = conn.execute("SELECT COUNT(*) AS count FROM analyses").fetchone()["count"]
            avg = conn.execute("SELECT AVG(confidence_score) AS avg_score FROM analyses").fetchone()["avg_score"]
            recent = self.list_recent(5)
        return {
            "total_analyses": count,
            "average_confidence": round(avg or 0, 1),
            "recent": recent,
        }

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
