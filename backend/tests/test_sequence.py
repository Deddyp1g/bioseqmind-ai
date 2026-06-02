import pytest

from app.services.sequence import SequenceValidationError, parse_sequence


def test_parse_fasta_dna_sequence_calculates_statistics():
    parsed = parse_sequence(">sample\nATGCATGCNN\n")

    assert parsed.name == "sample"
    assert parsed.sequence == "ATGCATGCNN"
    assert parsed.sequence_type == "DNA"
    assert parsed.length == 10
    assert parsed.gc_content == 40.0
    assert parsed.base_counts == {"A": 2, "T": 2, "G": 2, "C": 2, "U": 0, "N": 2}


def test_parse_plain_rna_sequence_detects_rna():
    parsed = parse_sequence("aucgaucg")

    assert parsed.name == "Pasted sequence"
    assert parsed.sequence == "AUCGAUCG"
    assert parsed.sequence_type == "RNA"
    assert parsed.gc_content == 50.0


def test_parse_fasta_with_escaped_newlines():
    parsed = parse_sequence(">escaped\\nATGCATGC\\n")

    assert parsed.name == "escaped"
    assert parsed.sequence == "ATGCATGC"


def test_parse_sequence_rejects_invalid_characters():
    with pytest.raises(SequenceValidationError) as exc:
        parse_sequence(">bad\nATGCXYZ")

    assert "非法字符" in str(exc.value)
