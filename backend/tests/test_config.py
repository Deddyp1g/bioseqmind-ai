from app.config import Settings


def test_settings_reads_bioseqmind_prefixed_environment(monkeypatch):
    monkeypatch.setenv("BIOSEQMIND_GENOMAD_COMMAND", "/opt/bioseqmind/genomad-wrapper")
    monkeypatch.setenv("BIOSEQMIND_GENOMAD_DB_PATH", "/opt/bioseqmind/genomad_db")
    monkeypatch.setenv("BIOSEQMIND_NCBI_MODE", "live")

    settings = Settings()

    assert settings.genomad_command == "/opt/bioseqmind/genomad-wrapper"
    assert settings.genomad_db_path == "/opt/bioseqmind/genomad_db"
    assert settings.ncbi_mode == "live"


def test_settings_reads_unprefixed_deepseek_key(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test-deepseek")

    settings = Settings()

    assert settings.deepseek_api_key == "sk-test-deepseek"
