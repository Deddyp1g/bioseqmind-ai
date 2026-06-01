from app.models.analysis import BlastHit, GenomadPrediction, SequenceStats
from app.services.fusion import fuse_results


def test_fusion_scores_high_when_genomad_and_blast_agree():
    stats = SequenceStats(
        name="seq1",
        sequence="ATGC" * 100,
        sequence_type="DNA",
        length=400,
        gc_content=50.0,
        base_counts={"A": 100, "T": 100, "G": 100, "C": 100, "U": 0, "N": 0},
        base_ratios={"A": 25.0, "T": 25.0, "G": 25.0, "C": 25.0, "U": 0.0, "N": 0.0},
        invalid_characters=[],
        quality_score=0.94,
    )
    genomad = GenomadPrediction(
        label="Virus",
        confidence=0.92,
        virus_score=0.92,
        plasmid_score=0.12,
        source="genomad",
        evidence=["high-confidence viral signal"],
    )
    hits = [
        BlastHit(
            rank=1,
            accession="NC_001416.1",
            title="Enterobacteria phage lambda genome",
            organism="Enterobacteria phage lambda",
            identity=97.2,
            coverage=91.0,
            evalue=1e-30,
            bit_score=500.0,
            source="ncbi",
        )
    ]

    fused = fuse_results(stats, genomad, hits)

    assert fused.candidate_source == "Enterobacteria phage lambda"
    assert fused.risk_level == "High"
    assert fused.confidence_score >= 85
    assert fused.requires_validation is False


def test_fusion_recommends_validation_for_weak_or_missing_evidence():
    stats = SequenceStats(
        name="short",
        sequence="ATGC",
        sequence_type="DNA",
        length=4,
        gc_content=50.0,
        base_counts={"A": 1, "T": 1, "G": 1, "C": 1, "U": 0, "N": 0},
        base_ratios={"A": 25.0, "T": 25.0, "G": 25.0, "C": 25.0, "U": 0.0, "N": 0.0},
        invalid_characters=[],
        quality_score=0.5,
    )
    genomad = GenomadPrediction(
        label="Uncertain",
        confidence=0.35,
        virus_score=0.22,
        plasmid_score=0.18,
        source="genomad",
        evidence=["sequence too short"],
    )

    fused = fuse_results(stats, genomad, [])

    assert fused.risk_level == "Low"
    assert fused.confidence_score < 55
    assert fused.requires_validation is True
