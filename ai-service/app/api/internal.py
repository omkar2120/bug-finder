from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from app.config.settings import get_settings
from app.providers.gateway import get_provider
from app.schemas.contracts import (
    BugAnalysisRequest,
    ContentAnalysisRequest,
    DuplicateDetectionRequest,
    RiskAnalysisRequest,
    TestGenerationRequest,
    VisualAnalysisRequest,
)

router = APIRouter(prefix="/internal/ai")


def authorize(secret: Optional[str]) -> None:
    expected = get_settings().AI_SERVICE_SECRET
    if not secret or secret != expected:
        raise HTTPException(status_code=401, detail="Invalid service credential")


@router.post("/test-generation")
def test_generation(payload: TestGenerationRequest, x_bugpilot_service_key: Optional[str] = Header(default=None)):
    authorize(x_bugpilot_service_key)
    return get_provider().generate_tests(payload)


@router.post("/analyze-bug")
def analyze_bug(payload: BugAnalysisRequest, x_bugpilot_service_key: Optional[str] = Header(default=None)):
    authorize(x_bugpilot_service_key)
    return get_provider().analyze_bug(payload)


@router.post("/analyze-content")
def analyze_content(payload: ContentAnalysisRequest, x_bugpilot_service_key: Optional[str] = Header(default=None)):
    authorize(x_bugpilot_service_key)
    return get_provider().analyze_content(payload)


@router.post("/analyze-visual")
def analyze_visual(payload: VisualAnalysisRequest, x_bugpilot_service_key: Optional[str] = Header(default=None)):
    authorize(x_bugpilot_service_key)
    return get_provider().analyze_visual(payload)


@router.post("/detect-duplicates")
def detect_duplicates(payload: DuplicateDetectionRequest, x_bugpilot_service_key: Optional[str] = Header(default=None)):
    authorize(x_bugpilot_service_key)
    return get_provider().detect_duplicates(payload)


@router.post("/analyze-risk")
def analyze_risk(payload: RiskAnalysisRequest, x_bugpilot_service_key: Optional[str] = Header(default=None)):
    authorize(x_bugpilot_service_key)
    return get_provider().analyze_risk(payload)
