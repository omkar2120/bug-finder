from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[3]
_AI = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(_ROOT / ".env", _AI / ".env"), extra="ignore")

    AI_PROVIDER: str = "local"
    AI_MODEL: str = "local-heuristic"
    AI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    AI_SERVICE_SECRET: str = "change-me-internal-ai-service-secret"
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    GROQ_API_BASE: str = "https://api.groq.com/openai/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
