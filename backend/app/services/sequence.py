from app.models.analysis import SequenceStats


class SequenceValidationError(ValueError):
    pass


VALID_BASES = set("ACGTUN")


def parse_sequence(payload: str) -> SequenceStats:
    name, sequence = _read_fasta_or_plain(payload)
    if not sequence:
        raise SequenceValidationError("请输入 DNA/RNA 序列或上传 FASTA 文件。")

    invalid = sorted({base for base in sequence if base not in VALID_BASES})
    if invalid:
        raise SequenceValidationError(f"序列包含非法字符: {', '.join(invalid)}")

    counts = {base: sequence.count(base) for base in ["A", "T", "G", "C", "U", "N"]}
    length = len(sequence)
    gc_content = round(((counts["G"] + counts["C"]) / length) * 100, 2)
    ratios = {base: round((count / length) * 100, 2) for base, count in counts.items()}
    sequence_type = _detect_type(counts)
    quality_score = _quality_score(length, counts["N"])

    return SequenceStats(
        name=name,
        sequence=sequence,
        sequence_type=sequence_type,
        length=length,
        gc_content=gc_content,
        base_counts=counts,
        base_ratios=ratios,
        invalid_characters=invalid,
        quality_score=quality_score,
    )


def to_fasta(stats: SequenceStats) -> str:
    wrapped = "\n".join(stats.sequence[index : index + 80] for index in range(0, stats.length, 80))
    safe_name = stats.name.replace(" ", "_") or "BioSeqMind_sequence"
    return f">{safe_name}\n{wrapped}\n"


def _read_fasta_or_plain(payload: str) -> tuple[str, str]:
    lines = [line.strip() for line in payload.strip().splitlines() if line.strip()]
    if not lines:
        return "Pasted sequence", ""

    if lines[0].startswith(">"):
        name = lines[0][1:].strip() or "Uploaded sequence"
        sequence_lines = [line for line in lines[1:] if not line.startswith(">")]
    else:
        name = "Pasted sequence"
        sequence_lines = lines

    sequence = "".join(sequence_lines).replace(" ", "").replace("\t", "").upper()
    return name, sequence


def _detect_type(counts: dict[str, int]) -> str:
    if counts["U"] > 0 and counts["T"] == 0:
        return "RNA"
    if counts["T"] > 0 and counts["U"] == 0:
        return "DNA"
    return "Mixed"


def _quality_score(length: int, n_count: int) -> float:
    ambiguity_penalty = 1 - (n_count / length)
    length_factor = min(1.0, length / 100)
    return round(max(0.2, ambiguity_penalty * length_factor), 3)
