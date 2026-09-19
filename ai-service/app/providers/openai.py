from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

import httpx

from app.config.settings import get_settings
from app.providers.local import LocalHeuristicProvider
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


def _parse_json(content: str) -> Dict[str, Any]:
    text = (content or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


class CompatibleChatProvider:
    def __init__(self, name: str, base: str, model: Optional[str] = None) -> None:
        settings = get_settings()
        self.name = name
        self.model = model or settings.AI_MODEL
        self.api_key = settings.AI_API_KEY or settings.GROQ_API_KEY
        self.base = base.rstrip("/")
        self.fallback = LocalHeuristicProvider()

    def _chat(self, system: str, user: str) -> Dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("AI_API_KEY is not configured")
        payload = {
            "model": self.model,
            "temperature": 0.1,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if "gpt-oss" in (self.model or ""):
            payload["include_reasoning"] = False
        try:
            response = httpx.post(
                f"{self.base}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={**payload, "response_format": {"type": "json_object"}},
                timeout=60,
            )
            response.raise_for_status()
        except Exception:
            response = httpx.post(
                f"{self.base}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return _parse_json(content)

    def generate_tests(self, request: TestGenerationRequest) -> TestGenerationResponse:
        try:
            data = self._chat(
                "You are a senior QA engineer. Turn the developer's brief into structured Playwright tests. "
                "If brief.focusMode is page or validation, only test those pages. "
                "If brief.focusMode is validation, prefer form checks: submit empty required fields, invalid email, "
                "wrong format vs pattern, too-short vs minLength, password mismatch, then one valid happy path. "
                "If brief.customCases or brief.instructions are present, those are required tests — implement each one "
                "(validations, empty fields, invalid formats, happy path, and the described user flow). "
                "Use discovered elements for selectors. Look at required, pattern, minLength, maxLength, label, inputType. "
                "Every validation test MUST end with an assert: expected ':invalid' for native HTML5, "
                "or the visible error text (Required, invalid email, etc). Never invent unauthorized URLs or credentials. "
                "Return JSON {tests:[{name,description,type,priority,preconditions,steps,expectedResult,confidence}]}. "
                "steps[].action must be navigate|click|type|select|submit|wait|assert.",
                request.model_dump_json(),
            )
            parsed = TestGenerationResponse(tests=data.get("tests") or [], provider=self.name, model=self.model)
            if parsed.tests:
                return parsed
        except Exception:
            pass
        result = self.fallback.generate_tests(request)
        result.provider = self.name
        result.model = self.model
        return result

    def analyze_bug(self, request: BugAnalysisRequest) -> BugAnalysisResponse:
        try:
            data = self._chat(
                "Classify whether a test failure is a real application bug. Distinguish environment, network, test, and product defects. Return JSON.",
                request.model_dump_json(),
            )
            return BugAnalysisResponse(**data, provider=self.name, model=self.model)
        except Exception:
            result = self.fallback.analyze_bug(request)
            result.provider = self.name
            result.model = self.model
            return result

    def analyze_content(self, request: ContentAnalysisRequest) -> ContentAnalysisResponse:
        try:
            data = self._chat(
                "You are a senior copy editor. Find spelling, grammar, punctuation, articles (a/an), "
                "subject-verb agreement, placeholders, and broken visible text. "
                "Return JSON {issues:[{type,currentText,suggestedText,confidence,severity,selector,tag,explanation}]}. "
                "type must be one of: spelling, grammar, broken_text, placeholder, inconsistent_label, translation, undefined_text, other.",
                request.model_dump_json(),
            )
            return ContentAnalysisResponse(issues=data.get("issues") or [], provider=self.name, model=self.model)
        except Exception:
            result = self.fallback.analyze_content(request)
            result.provider = self.name
            result.model = self.model
            return result

    def detect_duplicates(self, request: DuplicateDetectionRequest) -> DuplicateDetectionResponse:
        try:
            data = self._chat(
                "Group bugs that share a root cause. Return JSON {groups:[]}.",
                request.model_dump_json(),
            )
            return DuplicateDetectionResponse(groups=data.get("groups") or [], provider=self.name, model=self.model)
        except Exception:
            result = self.fallback.detect_duplicates(request)
            result.provider = self.name
            result.model = self.model
            return result

    def analyze_risk(self, request: RiskAnalysisRequest) -> dict:
        result = self.fallback.analyze_risk(request)
        result["provider"] = self.name
        result["model"] = self.model
        return result

    def analyze_visual(self, request: VisualAnalysisRequest) -> dict:
        result = self.fallback.analyze_visual(request)
        result["provider"] = self.name
        result["model"] = self.model
        return result


class OpenAIProvider(CompatibleChatProvider):
    def __init__(self) -> None:
        settings = get_settings()
        super().__init__(name="openai", base=settings.OPENAI_API_BASE, model=settings.AI_MODEL)
