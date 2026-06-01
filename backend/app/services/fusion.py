from math import log10

from app.models.analysis import BlastHit, FusionResult, GenomadPrediction, SequenceStats


def fuse_results(
    stats: SequenceStats, genomad: GenomadPrediction, blast_hits: list[BlastHit]
) -> FusionResult:
    top_hit = blast_hits[0] if blast_hits else None
    genomad_component = genomad.confidence * 100
    blast_component = _blast_component(top_hit)
    quality_component = stats.quality_score * 100
    length_component = min(100, max(5, stats.length / 25))

    score = round(
        (0.42 * genomad_component)
        + (0.34 * blast_component)
        + (0.14 * quality_component)
        + (0.10 * length_component)
    )
    score = int(max(0, min(100, score)))

    risk_level = "High" if score >= 75 else "Medium" if score >= 55 else "Low"
    candidate_source = top_hit.organism if top_hit else _label_candidate(genomad.label)
    requires_validation = score < 70 or not blast_hits

    reasoning = [
        f"geNomad 分类为 {genomad.label}，置信度 {genomad.confidence:.2f}。",
        f"序列长度 {stats.length} bp/nt，GC 含量 {stats.gc_content:.2f}%。",
    ]
    if top_hit:
        reasoning.append(
            f"BLAST Top Hit 为 {top_hit.accession}，identity {top_hit.identity:.2f}%，coverage {top_hit.coverage:.2f}%，E-value {top_hit.evalue:.2e}。"
        )
    else:
        reasoning.append("未获得 BLAST 命中结果，可信度主要依赖序列质量与 geNomad 证据。")

    return FusionResult(
        candidate_source=candidate_source,
        confidence_score=score,
        risk_level=risk_level,
        requires_validation=requires_validation,
        reasoning=reasoning,
    )


def _blast_component(hit: BlastHit | None) -> float:
    if hit is None:
        return 0.0
    evalue_score = 100 if hit.evalue <= 0 else max(0.0, min(100.0, -log10(hit.evalue) * 5))
    return (0.52 * hit.identity) + (0.36 * hit.coverage) + (0.12 * evalue_score)


def _label_candidate(label: str) -> str:
    if label == "Virus":
        return "潜在病毒相关序列"
    if label == "Plasmid":
        return "潜在质粒相关序列"
    return "来源未确定"
