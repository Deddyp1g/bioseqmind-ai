from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="BIOSEQMIND_",
        extra="ignore",
    )

    app_name: str = "BioSeqMind-AI"
    cors_origins: str = "http://localhost:5174,http://127.0.0.1:5174"
    db_path: str = "data/bioseqmind.sqlite3"

    genomad_command: str = "genomad"
    genomad_db_path: str = ""
    genomad_mode: str = "fast_nn"
    genomad_single_window: bool = True
    genomad_threads: int = 24
    genomad_splits: int = 0
    genomad_timeout_seconds: int = 3600

    ncbi_mode: str = "live"
    ncbi_email: str = "bioseqmind@example.com"
    ncbi_tool: str = "BioSeqMindAI"
    ncbi_timeout_seconds: int = 45
    ncbi_poll_seconds: int = 3

    deepseek_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("DEEPSEEK_API_KEY", "BIOSEQMIND_DEEPSEEK_API_KEY"),
    )
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"
    deepseek_timeout_seconds: int = 45

    def resolved_db_path(self) -> Path:
        return Path(self.db_path).expanduser().resolve()

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def refresh_settings() -> None:
    get_settings.cache_clear()
