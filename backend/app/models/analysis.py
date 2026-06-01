from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class SequenceStats(BaseModel):
    name: str
    sequence: str
    sequence_type: Literal["DNA", "RNA", "Mixed"]
    length: int
    gc_content: float
    base_counts: dict[str, int]
    base_ratios: dict[str, float]
    invalid_characters: list[str]
    quality_score: float


class GenomadPrediction(BaseModel):
    label: str
    confidence: float
    virus_score: float
    plasmid_score: float
    source: str
    evidence: list[str] = Field(default_factory=list)
    raw_outputs: dict[str, Any] = Field(default_factory=dict)


class BlastHit(BaseModel):
    rank: int
    accession: str
    title: str
    organism: str
    identity: float
    coverage: float
    evalue: float
    bit_score: float
    source: str
    annotations: dict[str, Any] = Field(default_factory=dict)


class FusionResult(BaseModel):
    candidate_source: str
    confidence_score: int
    risk_level: Literal["Low", "Medium", "High"]
    requires_validation: bool
    reasoning: list[str]


class ReportResult(BaseModel):
    markdown: str
    source: str
    model: str


class PipelineStep(BaseModel):
    key: str
    label: str
    status: Literal["pending", "running", "completed", "failed"]
    detail: str
    elapsed_ms: int


class AnalysisResult(BaseModel):
    id: str
    created_at: datetime
    status: Literal["completed", "failed"]
    sequence: SequenceStats
    genomad: GenomadPrediction
    blast_hits: list[BlastHit]
    fusion: FusionResult
    report: ReportResult
    timeline: list[PipelineStep]
    warnings: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    answer: str
    source: str
    model: str
