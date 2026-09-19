from app.config.settings import get_settings
from app.providers.local import LocalHeuristicProvider
from app.providers.openai import CompatibleChatProvider, OpenAIProvider

GROQ_ALIASES = {"groq", "groqcloud", "groq-cloud"}


def _model_or_default(settings, default: str) -> str:
    model = settings.AI_MODEL
    if not model or model == "local-heuristic":
        return default
    return model


def get_provider():
    settings = get_settings()
    provider = (settings.AI_PROVIDER or "local").lower()
    if provider in GROQ_ALIASES:
        return CompatibleChatProvider(
            name="groq",
            base=settings.GROQ_API_BASE,
            model=_model_or_default(settings, "openai/gpt-oss-20b"),
        )
    if provider == "openai":
        return OpenAIProvider()
    return LocalHeuristicProvider()
