from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class GeneratedStep(BaseModel):
    order: int
    action: Literal["navigate", "click", "type", "select", "submit", "wait", "assert"]
    target: Optional[str] = None
    value: Optional[str] = None
    expected: Optional[str] = None


class GeneratedTest(BaseModel):
    name: str
    description: Optional[str] = None
    type: Literal[
        "functional",
        "negative",
        "boundary",
        "validation",
        "navigation",
        "session",
        "api",
        "accessibility",
        "content",
    ]
    priority: Literal["critical", "high", "medium", "low"] = "medium"
    preconditions: List[str] = Field(default_factory=list)
    steps: List[GeneratedStep]
    expectedResult: str
    confidence: float = 0.8


class FocusBrief(BaseModel):
    focusMode: Literal["full", "page", "validation", "flow"] = "full"
    focusPages: List[str] = Field(default_factory=list)
    instructions: str = ""
    customCases: List[str] = Field(default_factory=list)


class TestGenerationRequest(BaseModel):
    projectId: str
    testRunId: Optional[str] = None
    applicationContext: Dict[str, Any]
    requirements: List[Any] = Field(default_factory=list)
    brief: Optional[FocusBrief] = None
    limits: Dict[str, Any] = Field(default_factory=dict)


class TestGenerationResponse(BaseModel):
    tests: List[GeneratedTest]
    provider: str
    model: str
    tokenUsage: Optional[Dict[str, int]] = None


class BugAnalysisRequest(BaseModel):
    projectId: str
    testRunId: str
    test: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    page: Optional[Dict[str, Any]] = None
    apiEvidence: List[Dict[str, Any]] = Field(default_factory=list)
    consoleErrors: List[str] = Field(default_factory=list)
    screenshotReferences: List[Any] = Field(default_factory=list)


class BugAnalysisResponse(BaseModel):
    isBug: bool
    confidence: float
    severity: Optional[Literal["critical", "high", "medium", "low"]] = None
    category: Optional[str] = None
    title: Optional[str] = None
    expected: Optional[str] = None
    actual: Optional[str] = None
    rootCause: Optional[str] = None
    reproductionSteps: List[str] = Field(default_factory=list)
    provider: str
    model: str


class ContentElement(BaseModel):
    selector: Optional[str] = None
    tag: Optional[str] = None
    text: Optional[str] = None


class ContentAnalysisRequest(BaseModel):
    projectId: str
    testRunId: str
    pageUrl: str
    elements: List[ContentElement]


class ContentIssue(BaseModel):
    type: str
    currentText: str
    suggestedText: Optional[str] = None
    confidence: float
    severity: Literal["high", "medium", "low"] = "low"
    selector: Optional[str] = None
    tag: Optional[str] = None
    explanation: Optional[str] = None


class ContentAnalysisResponse(BaseModel):
    issues: List[ContentIssue]
    provider: str
    model: str


class DuplicateDetectionRequest(BaseModel):
    projectId: str
    testRunId: str
    bugs: List[Dict[str, Any]]


class DuplicateGroup(BaseModel):
    primaryBugId: str
    duplicateBugIds: List[str]
    confidence: float
    reason: str


class DuplicateDetectionResponse(BaseModel):
    groups: List[DuplicateGroup]
    provider: str
    model: str


class RiskAnalysisRequest(BaseModel):
    projectId: str
    testRunId: str
    statistics: Optional[Dict[str, Any]] = None


class VisualAnalysisRequest(BaseModel):
    projectId: str
    testRunId: str
    pageUrl: Optional[str] = None
    notes: Optional[str] = None
