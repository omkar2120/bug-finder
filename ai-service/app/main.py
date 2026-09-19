from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.internal import router


def create_app() -> FastAPI:
    app = FastAPI(title="BugPilot AI Service", docs_url=None, redoc_url=None, openapi_url=None)
    app.include_router(router)

    @app.get("/health")
    def health():
        from app.providers.gateway import get_provider

        provider = get_provider()
        from app.config.settings import get_settings

        settings = get_settings()
        return JSONResponse(
            {
                "success": True,
                "data": {
                    "status": "ok",
                    "service": "bugpilot-ai",
                    "provider": getattr(provider, "name", "local"),
                    "model": getattr(provider, "model", "local-heuristic"),
                    "configured": bool(settings.AI_API_KEY or settings.GROQ_API_KEY),
                },
            }
        )

    return app


app = create_app()
