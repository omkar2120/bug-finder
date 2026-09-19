from __future__ import annotations

from typing import Protocol

from app.schemas.contracts import (
    BugAnalysisRequest,
    BugAnalysisResponse,
    ContentAnalysisRequest,
    ContentAnalysisResponse,
    DuplicateDetectionRequest,
    DuplicateDetectionResponse,
    RiskAnalysisRequest,
    TestGenerationRequest,
    TestGenerationResponse,
    VisualAnalysisRequest,
)


class AIProvider(Protocol):
    name: str
    model: str

    def generate_tests(self, request: TestGenerationRequest) -> TestGenerationResponse: ...
    def analyze_bug(self, request: BugAnalysisRequest) -> BugAnalysisResponse: ...
    def analyze_content(self, request: ContentAnalysisRequest) -> ContentAnalysisResponse: ...
    def detect_duplicates(self, request: DuplicateDetectionRequest) -> DuplicateDetectionResponse: ...
    def analyze_risk(self, request: RiskAnalysisRequest) -> dict: ...
    def analyze_visual(self, request: VisualAnalysisRequest) -> dict: ...
