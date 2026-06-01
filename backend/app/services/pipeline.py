import time
import uuid
from datetime import datetime, timezone
from typing import Awaitable, Callable, TypeVar

from app.config import Settings
from app.models.analysis import AnalysisResult, PipelineStep
from app.repository import AnalysisRepository
from app.services.deepseek import generate_report
from app.services.fusion import fuse_results
from app.services.genomad import run_genomad
from app.services.ncbi import run_blast
from app.services.sequence import parse_sequence


T = TypeVar("T")


async def run_analysis(payload: str, settings: Settings, repository: AnalysisRepository) -> AnalysisResult:
    timeline: list[PipelineStep] = []
    warnings: list[str] = []

    stats = await _step(
        timeline,
        "sequence",
        "序列检查",
        "完成 FASTA 解析、类型判断、长度与 GC 统计。",
        lambda: _instant(parse_sequence(payload)),
    )
    genomad = await _step(
        timeline,
        "genomad",
        "geNomad 识别",
        "完成病毒/质粒候选识别。",
        lambda: _instant(run_genomad(stats, settings)),
    )
    blast_hits, blast_warnings = await _step(
        timeline,
        "ncbi",
        "NCBI 查询",
        "完成 BLAST Top 5 与 E-utilities 注释。",
        lambda: run_blast(stats, settings),
    )
    warnings.extend(blast_warnings)
    fusion = await _step(
        timeline,
        "fusion",
        "结果融合",
        "完成综合可信度评分与关注等级判断。",
        lambda: _instant(fuse_results(stats, genomad, blast_hits)),
    )
    report = await _step(
        timeline,
        "deepseek",
        "DeepSeek 分析",
        "完成 AI 解释与 Markdown 报告生成。",
        lambda: generate_report(stats, genomad, blast_hits, fusion, settings),
    )
    timeline.append(
        PipelineStep(
            key="report",
            label="报告生成",
            status="completed",
            detail="报告已写入 SQLite，可继续追问或导出 Markdown。",
            elapsed_ms=0,
        )
    )

    analysis = AnalysisResult(
        id=str(uuid.uuid4()),
        created_at=datetime.now(timezone.utc),
        status="completed",
        sequence=stats,
        genomad=genomad,
        blast_hits=blast_hits,
        fusion=fusion,
        report=report,
        timeline=timeline,
        warnings=warnings,
    )
    repository.save(analysis)
    return analysis


async def _step(
    timeline: list[PipelineStep],
    key: str,
    label: str,
    detail: str,
    func: Callable[[], Awaitable[T]],
) -> T:
    start = time.perf_counter()
    result = await func()
    elapsed = int((time.perf_counter() - start) * 1000)
    timeline.append(PipelineStep(key=key, label=label, status="completed", detail=detail, elapsed_ms=elapsed))
    return result


async def _instant(value: T) -> T:
    return value

