import asyncio
import re
from urllib.parse import urlencode

import httpx

from app.config import Settings
from app.models.analysis import BlastHit, SequenceStats
from app.services.errors import ExternalDependencyError
from app.services.sequence import to_fasta


BLAST_URL = "https://blast.ncbi.nlm.nih.gov/Blast.cgi"
EUTILS_SUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"


async def run_blast(stats: SequenceStats, settings: Settings) -> tuple[list[BlastHit], list[str]]:
    warnings: list[str] = []
    if settings.ncbi_mode != "live":
        raise ExternalDependencyError("真实数据模式要求 BIOSEQMIND_NCBI_MODE=live，禁止使用 mock/auto。")

    try:
        hits = await _run_live_blast(stats, settings)
        if hits:
            return hits[:5], warnings
        return [], ["NCBI BLAST 已完成真实查询，但未返回命中。"]
    except Exception as exc:
        raise ExternalDependencyError(f"NCBI BLAST 真实查询失败，未生成 BLAST 结果: {exc}") from exc


async def _run_live_blast(stats: SequenceStats, settings: Settings) -> list[BlastHit]:
    timeout = httpx.Timeout(settings.ncbi_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        put_response = await client.post(
            BLAST_URL,
            data={
                "CMD": "Put",
                "PROGRAM": "blastn",
                "DATABASE": "nt",
                "QUERY": to_fasta(stats),
                "MEGABLAST": "on",
                "HITLIST_SIZE": "5",
            },
        )
        put_response.raise_for_status()
        rid = _match_value(put_response.text, "RID")
        if not rid:
            raise RuntimeError("NCBI 未返回 RID。")

        result_text = ""
        for _ in range(max(1, settings.ncbi_timeout_seconds // settings.ncbi_poll_seconds)):
            await asyncio.sleep(settings.ncbi_poll_seconds)
            query = urlencode(
                {
                    "CMD": "Get",
                    "RID": rid,
                    "FORMAT_TYPE": "Text",
                    "ALIGNMENT_VIEW": "Tabular",
                    "DESCRIPTIONS": "5",
                    "ALIGNMENTS": "5",
                }
            )
            get_response = await client.get(f"{BLAST_URL}?{query}")
            get_response.raise_for_status()
            result_text = get_response.text
            if "Status=WAITING" in result_text:
                continue
            if "Status=FAILED" in result_text or "Status=UNKNOWN" in result_text:
                raise RuntimeError("NCBI BLAST RID 失败或过期。")
            break

        hits = _parse_tabular(result_text)
        if hits:
            await _annotate_hits(client, hits, settings)
        return hits


def _parse_tabular(text: str) -> list[BlastHit]:
    hits: list[BlastHit] = []
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 12:
            continue
        accession = _extract_accession(parts[1])
        identity = _safe_float(parts[2])
        align_len = _safe_float(parts[3])
        q_start = _safe_float(parts[6])
        q_end = _safe_float(parts[7])
        coverage = min(100.0, abs(q_end - q_start + 1) / align_len * 100) if align_len else 0.0
        hits.append(
            BlastHit(
                rank=len(hits) + 1,
                accession=accession,
                title=accession,
                organism="NCBI nucleotide record",
                identity=round(identity, 2),
                coverage=round(coverage, 2),
                evalue=_safe_float(parts[10]),
                bit_score=_safe_float(parts[11]),
                source="ncbi",
            )
        )
    return hits[:5]


async def _annotate_hits(client: httpx.AsyncClient, hits: list[BlastHit], settings: Settings) -> None:
    ids = ",".join(hit.accession for hit in hits if hit.accession)
    if not ids:
        return
    response = await client.get(
        EUTILS_SUMMARY_URL,
        params={
            "db": "nuccore",
            "id": ids,
            "retmode": "json",
            "tool": settings.ncbi_tool,
            "email": settings.ncbi_email,
        },
    )
    if response.is_error:
        return
    result = response.json().get("result", {})
    for hit in hits:
        doc = result.get(hit.accession) or next(
            (value for value in result.values() if isinstance(value, dict) and value.get("accessionversion") == hit.accession),
            None,
        )
        if isinstance(doc, dict):
            hit.title = doc.get("title") or hit.title
            hit.organism = doc.get("organism") or _organism_from_title(hit.title)
            hit.annotations = {
                "uid": doc.get("uid"),
                "taxid": doc.get("taxid"),
                "length": doc.get("slen"),
                "source_database": "NCBI ESummary nuccore",
            }


def _match_value(text: str, key: str) -> str:
    match = re.search(rf"{key}\s*=\s*([A-Z0-9-]+)", text)
    return match.group(1).strip() if match else ""


def _extract_accession(raw: str) -> str:
    segments = [segment for segment in raw.split("|") if segment]
    for segment in segments:
        if re.match(r"^[A-Z]{1,4}_?\d+(?:\.\d+)?$", segment):
            return segment
    return segments[-1] if segments else raw


def _organism_from_title(title: str) -> str:
    return title.split(",")[0].split(" complete ")[0][:120] or "NCBI nucleotide record"


def _safe_float(value: str) -> float:
    try:
        return float(value)
    except ValueError:
        return 0.0
