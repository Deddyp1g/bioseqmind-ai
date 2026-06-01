import asyncio
import subprocess
from pathlib import Path

import pytest

from app.config import Settings
from app.models.analysis import FusionResult, GenomadPrediction, SequenceStats
from app.services.deepseek import generate_report
from app.services.errors import ExternalDependencyError
from app.services.genomad import run_genomad
from app.services.ncbi import run_blast


def _stats() -> SequenceStats:
    return SequenceStats(
        name="real-mode-test",
        sequence="ATGC" * 20,
        sequence_type="DNA",
        length=80,
        gc_content=50.0,
        base_counts={"A": 20, "T": 20, "G": 20, "C": 20, "U": 0, "N": 0},
        base_ratios={"A": 25.0, "T": 25.0, "G": 25.0, "C": 25.0, "U": 0.0, "N": 0.0},
        invalid_characters=[],
        quality_score=1.0,
    )


def test_settings_default_to_real_data_mode():
    settings = Settings()

    assert settings.ncbi_mode == "live"
    assert settings.genomad_mode == "fast_nn"
    assert settings.genomad_threads == 24


def test_genomad_fast_mode_runs_nn_classification_and_summary(monkeypatch, tmp_path):
    calls: list[list[str]] = []

    def which_stub(command: str) -> str:
        return f"/usr/bin/{command}"

    def run_stub(cmd: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        calls.append(cmd)
        if "summary" in cmd:
            output_dir = Path(cmd[-1])
            summary_dir = output_dir / "query_summary"
            summary_dir.mkdir(parents=True)
            (summary_dir / "query_virus_summary.tsv").write_text(
                "seq_name\tlength\ttopology\tcoordinates\tn_genes\tgenetic_code\tvirus_score\tfdr\tn_hallmarks\tmarker_enrichment\ttaxonomy\n"
                "real-mode-test\t80\tNo terminal repeats\t1-80\t1\t11\t0.93\t0.01\t0\t0\tViruses\n",
                encoding="utf-8",
            )
        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

    monkeypatch.setattr("app.services.genomad.shutil.which", which_stub)
    monkeypatch.setattr("app.services.genomad.subprocess.run", run_stub)

    prediction = run_genomad(
        _stats(),
        Settings(_env_file=None, genomad_mode="fast_nn", genomad_db_path=str(tmp_path / "unused-db")),
    )

    assert [call[1] for call in calls] == ["nn-classification", "summary"]
    assert calls[0][0] == "/usr/bin/genomad"
    assert "--single-window" in calls[0]
    assert prediction.label == "Virus"
    assert prediction.confidence == 0.93
    assert prediction.source == "genomad:fast_nn"


def test_genomad_missing_dependency_raises_instead_of_synthetic_result():
    settings = Settings(genomad_command="missing-genomad-for-real-mode", genomad_db_path="/missing/db")

    with pytest.raises(ExternalDependencyError):
        run_genomad(_stats(), settings)


def test_ncbi_non_live_mode_is_rejected():
    settings = Settings(ncbi_mode="auto")

    with pytest.raises(ExternalDependencyError):
        asyncio.run(run_blast(_stats(), settings))


def test_deepseek_missing_key_raises_instead_of_template_report():
    stats = _stats()
    genomad = GenomadPrediction(
        label="Uncertain",
        confidence=0.0,
        virus_score=0.0,
        plasmid_score=0.0,
        source="genomad",
        evidence=["geNomad completed without a virus or plasmid call."],
    )
    fusion = FusionResult(
        candidate_source="No BLAST hit",
        confidence_score=0,
        risk_level="Low",
        requires_validation=True,
        reasoning=["No live evidence was available."],
    )

    with pytest.raises(ExternalDependencyError):
        asyncio.run(generate_report(stats, genomad, [], fusion, Settings(_env_file=None, DEEPSEEK_API_KEY="")))
