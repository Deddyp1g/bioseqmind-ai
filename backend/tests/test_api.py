from fastapi.testclient import TestClient

from app.main import app
from app.models.analysis import BlastHit, GenomadPrediction, ReportResult


def test_analyze_sequence_returns_complete_result(monkeypatch, tmp_path):
    monkeypatch.setenv("BIOSEQMIND_DB_PATH", str(tmp_path / "test.sqlite3"))
    monkeypatch.setenv("BIOSEQMIND_NCBI_MODE", "live")

    def genomad_stub(*_):
        return GenomadPrediction(
            label="Virus",
            confidence=0.9,
            virus_score=0.9,
            plasmid_score=0.1,
            source="genomad",
            evidence=["test double for real geNomad contract"],
        )

    async def blast_stub(*_):
        return [
            BlastHit(
                rank=1,
                accession="NC_TEST.1",
                title="NCBI nucleotide test record",
                organism="NCBI nucleotide record",
                identity=99.0,
                coverage=95.0,
                evalue=1e-20,
                bit_score=300.0,
                source="ncbi",
            )
        ], []

    async def report_stub(*_):
        return ReportResult(markdown="# BioSeqMind-AI\n\n真实依赖测试替身。", source="deepseek", model="deepseek-v4-flash")

    monkeypatch.setattr("app.services.pipeline.run_genomad", genomad_stub)
    monkeypatch.setattr("app.services.pipeline.run_blast", blast_stub)
    monkeypatch.setattr("app.services.pipeline.generate_report", report_stub)

    with TestClient(app) as client:
        response = client.post(
            "/api/analyses",
            data={"sequence_text": ">submitted_sequence\nATGCGTACGTAGCTAGCTAGCTAGCTAGCTAGC"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["sequence"]["sequence_type"] == "DNA"
    assert len(payload["blast_hits"]) == 1
    assert payload["blast_hits"][0]["source"] == "ncbi"
    assert payload["genomad"]["source"] == "genomad"
    assert payload["report"]["source"] == "deepseek"
    assert payload["report"]["markdown"].startswith("# BioSeqMind-AI")


def test_chat_uses_existing_analysis_context(monkeypatch, tmp_path):
    monkeypatch.setenv("BIOSEQMIND_DB_PATH", str(tmp_path / "chat.sqlite3"))
    monkeypatch.setenv("BIOSEQMIND_NCBI_MODE", "live")

    def genomad_stub(*_):
        return GenomadPrediction(
            label="Uncertain",
            confidence=0.0,
            virus_score=0.0,
            plasmid_score=0.0,
            source="genomad",
            evidence=["test double for real geNomad contract"],
        )

    async def blast_stub(*_):
        return [], ["NCBI BLAST 已完成真实查询，但未返回命中。"]

    async def report_stub(*_):
        return ReportResult(markdown="# BioSeqMind-AI\n\n无命中。", source="deepseek", model="deepseek-v4-flash")

    async def answer_stub(*_):
        return "可信度来自真实依赖返回的数据。", "deepseek", "deepseek-v4-flash"

    monkeypatch.setattr("app.services.pipeline.run_genomad", genomad_stub)
    monkeypatch.setattr("app.services.pipeline.run_blast", blast_stub)
    monkeypatch.setattr("app.services.pipeline.generate_report", report_stub)
    monkeypatch.setattr("app.main.answer_question", answer_stub)

    with TestClient(app) as client:
        created = client.post(
            "/api/analyses",
            data={"sequence_text": "AUGCAUGCAUGCAUGCAUGCAUGCAUGC"},
        ).json()
        response = client.post(
            f"/api/analyses/{created['id']}/chat",
            json={"message": "为什么可信度是这个分数？"},
        )

    assert response.status_code == 200
    assert "可信度" in response.json()["answer"]
