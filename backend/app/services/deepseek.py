import httpx

from app.config import Settings
from app.models.analysis import AnalysisResult, BlastHit, FusionResult, GenomadPrediction, ReportResult, SequenceStats
from app.services.errors import ExternalDependencyError


async def generate_report(
    stats: SequenceStats,
    genomad: GenomadPrediction,
    blast_hits: list[BlastHit],
    fusion: FusionResult,
    settings: Settings,
) -> ReportResult:
    if settings.deepseek_api_key:
        try:
            content = await _call_deepseek(_report_prompt(stats, genomad, blast_hits, fusion), settings)
            return ReportResult(markdown=content, source="deepseek", model=settings.deepseek_model)
        except Exception as exc:
            raise ExternalDependencyError(f"DeepSeek 真实调用失败，未生成 AI 报告: {exc}") from exc

    raise ExternalDependencyError("未配置 DEEPSEEK_API_KEY，无法生成真实 DeepSeek 报告。")


async def answer_question(analysis: AnalysisResult, question: str, settings: Settings) -> tuple[str, str, str]:
    if settings.deepseek_api_key:
        try:
            prompt = (
                "你是 BioSeqMind-AI 的生物信息分析助手。请基于以下分析结果回答用户追问，"
                "强调证据来源、可信度和局限性。\n\n"
                f"分析 JSON 摘要：{analysis.model_dump_json(exclude={'sequence': {'sequence'}})}\n\n"
                f"用户问题：{question}"
            )
            return await _call_deepseek(prompt, settings), "deepseek", settings.deepseek_model
        except Exception as exc:
            raise ExternalDependencyError(f"DeepSeek 真实调用失败，未生成问答回复: {exc}") from exc

    raise ExternalDependencyError("未配置 DEEPSEEK_API_KEY，无法生成真实 DeepSeek 问答回复。")


async def _call_deepseek(prompt: str, settings: Settings) -> str:
    async with httpx.AsyncClient(timeout=settings.deepseek_timeout_seconds) as client:
        response = await client.post(
            f"{settings.deepseek_base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.deepseek_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.deepseek_model,
                "messages": [
                    {"role": "system", "content": "你是严谨的生物信息学分析智能体，用中文输出。"},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


def _report_prompt(
    stats: SequenceStats,
    genomad: GenomadPrediction,
    blast_hits: list[BlastHit],
    fusion: FusionResult,
) -> str:
    hits = "\n".join(
        f"- {hit.rank}. {hit.accession} {hit.organism}, identity={hit.identity}%, coverage={hit.coverage}%, evalue={hit.evalue:.2e}"
        for hit in blast_hits
    )
    return f"""
请生成一份 Markdown 科研分析报告，包含：结论、序列质量、geNomad 证据、NCBI BLAST Top 5、综合可信度、误差来源、进一步验证建议。

序列：{stats.name}, 类型 {stats.sequence_type}, 长度 {stats.length}, GC {stats.gc_content}%
geNomad：{genomad.label}, confidence={genomad.confidence}, virus_score={genomad.virus_score}, plasmid_score={genomad.plasmid_score}, source={genomad.source}
BLAST：
{hits or "- 无命中"}
融合：candidate={fusion.candidate_source}, score={fusion.confidence_score}, risk={fusion.risk_level}, requires_validation={fusion.requires_validation}
""".strip()

