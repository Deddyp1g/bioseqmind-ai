import json
import re

import httpx

from app.config import Settings
from app.models.analysis import AnalysisResult, BlastHit, FusionResult, GenomadPrediction, ReportResult, SequenceStats
from app.services.errors import ExternalDependencyError
from app.services.sequence import SequenceValidationError, parse_sequence, to_fasta


async def normalize_sequence_input(payload: str, settings: Settings) -> tuple[str, str]:
    if not settings.deepseek_api_key:
        raise ExternalDependencyError("未配置 DEEPSEEK_API_KEY，无法执行 DeepSeek 输入格式预检。")

    try:
        content = await _call_deepseek(_normalization_prompt(payload), settings)
    except Exception as exc:
        raise ExternalDependencyError(f"DeepSeek 输入格式预检失败: {exc}") from exc

    decision = _parse_normalization_json(content)
    accepted = bool(decision.get("accept"))
    reason = str(decision.get("reason") or "").strip()
    corrected_fasta = str(decision.get("corrected_fasta") or "").strip()

    if not accepted:
        raise SequenceValidationError(reason or "输入内容与 DNA/RNA/FASTA 格式相差过多，已拒绝分析。")
    if not corrected_fasta:
        raise SequenceValidationError("DeepSeek 未返回可用的规范化 FASTA 序列。")

    try:
        stats = parse_sequence(corrected_fasta)
    except SequenceValidationError as exc:
        raise SequenceValidationError(f"DeepSeek 规范化后仍不是有效 DNA/RNA 序列: {exc}") from exc
    return to_fasta(stats), reason or "DeepSeek 已完成输入格式预检。"


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


def _parse_normalization_json(content: str) -> dict[str, object]:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise SequenceValidationError("DeepSeek 输入格式预检未返回 JSON。")
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise SequenceValidationError("DeepSeek 输入格式预检返回格式无效。")
    return data


def _normalization_prompt(payload: str) -> str:
    sample = payload[:12000]
    return f"""
你是 BioSeqMind-AI 的核酸序列输入预检器，只做格式判断和轻微格式修复，不做物种结论。

任务：
1. 判断输入是否主要是 DNA/RNA/FASTA 序列。
2. 如果只是少量格式问题，请修复为单条 FASTA，例如补充 header、移除空格、把字面量 \\n 变成真实换行、去掉行号或无关标点。
3. 如果输入与核酸序列格式相差过多，或大段是网页、论文、聊天文本、蛋白序列、随机字符，请拒绝。
4. 不允许凭空补充未知碱基；不确定位置只能保留 N。允许字符仅为 A/T/G/C/U/N。

只返回 JSON，不要 Markdown，不要解释性正文：
{{
  "accept": true,
  "corrected_fasta": ">sequence_name\\nATGC...",
  "reason": "一句中文说明你修复了什么，或为什么拒绝"
}}

输入：
{sample}
""".strip()


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

