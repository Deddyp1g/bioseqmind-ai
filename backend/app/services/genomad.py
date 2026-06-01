import csv
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.config import Settings
from app.models.analysis import GenomadPrediction, SequenceStats
from app.services.errors import ExternalDependencyError
from app.services.sequence import to_fasta


def run_genomad(stats: SequenceStats, settings: Settings) -> GenomadPrediction:
    command = shutil.which(settings.genomad_command)
    if not command:
        raise ExternalDependencyError("geNomad 命令未配置，无法生成真实 geNomad 结果。")

    with tempfile.TemporaryDirectory(prefix="bioseqmind-genomad-") as tmp:
        tmp_path = Path(tmp)
        input_path = tmp_path / "query.fna"
        output_path = tmp_path / "genomad_output"
        input_path.write_text(to_fasta(stats), encoding="utf-8")
        source = _run_genomad_command(command, input_path, output_path, settings)

        parsed = _parse_summary(output_path)
        if parsed:
            parsed.source = source
            return parsed
        return GenomadPrediction(
            label="Uncertain",
            confidence=0.0,
            virus_score=0.0,
            plasmid_score=0.0,
            source=source,
            evidence=["geNomad 已完成真实运行，但未输出可解析的病毒或质粒 summary。"],
        )


def _run_genomad_command(command: str, input_path: Path, output_path: Path, settings: Settings) -> str:
    mode = settings.genomad_mode.strip().lower()
    if mode == "fast_nn":
        nn_cmd = [
            command,
            "nn-classification",
            "--cleanup",
            "--restart",
            "--threads",
            str(settings.genomad_threads),
        ]
        if settings.genomad_single_window:
            nn_cmd.append("--single-window")
        nn_cmd.extend([str(input_path), str(output_path)])
        _run_checked(nn_cmd, settings)
        _run_checked([command, "summary", str(input_path), str(output_path)], settings)
        return "genomad:fast_nn"

    if mode == "end_to_end":
        database = Path(settings.genomad_db_path).expanduser() if settings.genomad_db_path else None
        if not database or not database.exists():
            raise ExternalDependencyError("geNomad 数据库未配置，无法生成真实 end-to-end 结果。")
        _run_checked(
            [
                command,
                "end-to-end",
                "--cleanup",
                "--splits",
                str(settings.genomad_splits),
                str(input_path),
                str(output_path),
                str(database),
            ],
            settings,
        )
        return "genomad:end_to_end"

    raise ExternalDependencyError(f"未知 geNomad 模式 {settings.genomad_mode!r}，无法生成真实模型结果。")


def _run_checked(cmd: list[str], settings: Settings) -> None:
    try:
        subprocess.run(
            cmd,
            check=True,
            text=True,
            capture_output=True,
            timeout=settings.genomad_timeout_seconds,
        )
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or str(exc)).strip()[-1200:]
        raise ExternalDependencyError(f"geNomad 执行失败，未生成真实模型结果: {detail}") from exc
    except subprocess.TimeoutExpired as exc:
        raise ExternalDependencyError("geNomad 执行超时，未生成真实模型结果。") from exc
    except OSError as exc:
        raise ExternalDependencyError(f"geNomad 无法启动，未生成真实模型结果: {exc}") from exc


def _parse_summary(output_path: Path) -> GenomadPrediction | None:
    virus_rows = _read_tsvs(output_path, "*_virus_summary.tsv")
    plasmid_rows = _read_tsvs(output_path, "*_plasmid_summary.tsv")
    best_virus = max((_float(row.get("virus_score")) for row in virus_rows), default=0.0)
    best_plasmid = max((_float(row.get("plasmid_score")) for row in plasmid_rows), default=0.0)

    if best_virus == 0.0 and best_plasmid == 0.0:
        return None

    label = "Virus" if best_virus >= best_plasmid else "Plasmid"
    confidence = max(best_virus, best_plasmid)
    evidence = [
        f"解析 geNomad summary：病毒候选 {len(virus_rows)} 个，质粒候选 {len(plasmid_rows)} 个。"
    ]
    return GenomadPrediction(
        label=label,
        confidence=round(confidence, 3),
        virus_score=round(best_virus, 3),
        plasmid_score=round(best_plasmid, 3),
        source="genomad",
        evidence=evidence,
        raw_outputs={"virus_rows": virus_rows[:3], "plasmid_rows": plasmid_rows[:3]},
    )


def _read_tsvs(root: Path, pattern: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for path in root.rglob(pattern):
        with path.open("r", encoding="utf-8", newline="") as handle:
            rows.extend(csv.DictReader(handle, delimiter="\t"))
    return rows


def _float(value: object) -> float:
    try:
        return float(value) if value not in (None, "", "NA") else 0.0
    except (TypeError, ValueError):
        return 0.0
