from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Dict, List

from app.schemas.contracts import (
    BugAnalysisRequest,
    BugAnalysisResponse,
    ContentAnalysisRequest,
    ContentAnalysisResponse,
    ContentIssue,
    DuplicateDetectionRequest,
    DuplicateDetectionResponse,
    DuplicateGroup,
    GeneratedStep,
    GeneratedTest,
    RiskAnalysisRequest,
    TestGenerationRequest,
    TestGenerationResponse,
    VisualAnalysisRequest,
)

PLACEHOLDER_RE = re.compile(r"\b(lorem ipsum|todo|tbd|placeholder|undefined|null|nan)\b", re.I)
BROKEN_RE = re.compile(r"(\[object Object\]|undefined|null|NaN)")
COMMON_TYPOS = {
    "adress": "Address",
    "recieve": "Receive",
    "occured": "Occurred",
    "seperate": "Separate",
    "sucess": "Success",
    "enviroment": "Environment",
    "widht": "Width",
    "heigth": "Height",
    "qunatity": "Quantity",
    "quantiy": "Quantity",
    "availible": "Available",
    "untill": "Until",
    "informations": "Information",
    "dont": "Don't",
    "cant": "Can't",
    "wont": "Won't",
    "isnt": "Isn't",
    "doesnt": "Doesn't",
    "didnt": "Didn't",
}

GRAMMAR_RE = [
    (re.compile(r"\b(a)\s+([aeiouAEIOU]\w*)"), "grammar", "Use 'an' before a vowel sound."),
    (re.compile(r"\b(\w+)\s+\1\b", re.I), "grammar", "Repeated word."),
    (re.compile(r"[.!?][A-Za-z]"), "grammar", "Add a space after punctuation."),
]


class LocalHeuristicProvider:
    name = "local"
    model = "local-heuristic"

    def generate_tests(self, request: TestGenerationRequest) -> TestGenerationResponse:
        pages = request.applicationContext.get("pages") or []
        tests: List[GeneratedTest] = []
        max_tests = int((request.limits or {}).get("maxTests") or 40)
        brief = request.brief
        focus_mode = (brief.focusMode if brief else "full") or "full"
        focus_pages = [p.lower() for p in (brief.focusPages if brief else [])]
        custom_cases = list(brief.customCases if brief else [])
        if brief and brief.instructions:
            custom_cases = [brief.instructions, *custom_cases]
        if focus_pages:
            focused = [page for page in pages if any(token in (page.get("url") or "").lower() for token in focus_pages)]
            pages = focused or pages

        start_url = pages[0].get("url") if pages else ""
        for case in custom_cases:
            expected = case
            name = case[:90]
            if "->" in case:
                name, expected = [part.strip() for part in case.split("->", 1)]
            elif "→" in case:
                name, expected = [part.strip() for part in case.split("→", 1)]
            kind = "validation" if re.search(r"valid|empty|required|invalid|error|boundary", case, re.I) else "functional"
            tests.append(
                GeneratedTest(
                    name=name,
                    description=case,
                    type=kind,
                    priority="high",
                    steps=[
                        GeneratedStep(order=1, action="navigate", value=start_url),
                        GeneratedStep(order=2, action="assert", value=start_url, expected=expected[:80]),
                    ],
                    expectedResult=expected,
                    confidence=0.86,
                )
            )

        skip_generic = focus_mode in {"page", "validation", "flow"} and bool(custom_cases)

        for page in pages[:12]:
            url = page.get("url") or ""
            title = page.get("title") or url
            elements = page.get("elements") or []
            if not skip_generic and focus_mode != "validation":
                tests.append(
                    GeneratedTest(
                        name=f"Open {title}",
                        description="Happy-path navigation to a discovered page",
                        type="navigation",
                        priority="high",
                        steps=[
                            GeneratedStep(order=1, action="navigate", value=url),
                            GeneratedStep(order=2, action="assert", expected=title[:40] or None, value=url),
                        ],
                        expectedResult=f"The page {url} loads inside the authorized domain.",
                        confidence=0.93,
                    )
                )

            email = next((e for e in elements if (e.get("inputType") or e.get("type") or "").lower() == "email"), None)
            password = next((e for e in elements if (e.get("inputType") or e.get("type") or "").lower() == "password"), None)
            submit = next((e for e in elements if e.get("tag") in {"button", "input"} and "submit" in f"{e.get('type','')} {e.get('text','')}".lower()), None)
            text_inputs = [e for e in elements if e.get("tag") in {"input", "textarea"}]
            required_fields = [e for e in text_inputs if e.get("required")]
            submit_target = submit.get("selector") if submit else None

            if text_inputs and (focus_mode == "validation" or required_fields or submit):
                tests.append(
                    GeneratedTest(
                        name="Submit empty form shows required errors",
                        description="Leave required fields empty and submit",
                        type="validation",
                        priority="high",
                        steps=[
                            GeneratedStep(order=1, action="navigate", value=url),
                            GeneratedStep(order=2, action="submit", target=submit_target),
                            GeneratedStep(order=3, action="assert", expected=":invalid"),
                        ],
                        expectedResult="Native or app validation blocks an empty submit.",
                        confidence=0.9,
                    )
                )
            if email:
                tests.append(
                    GeneratedTest(
                        name="Reject invalid email",
                        type="validation",
                        priority="high",
                        steps=[
                            GeneratedStep(order=1, action="navigate", value=url),
                            GeneratedStep(order=2, action="type", target=email.get("selector"), value="not-an-email"),
                            GeneratedStep(order=3, action="submit", target=submit_target),
                            GeneratedStep(order=4, action="assert", target=email.get("selector"), expected=":invalid"),
                        ],
                        expectedResult="Invalid email is marked invalid and the form does not accept it.",
                        confidence=0.94,
                    )
                )
            if password:
                tests.append(
                    GeneratedTest(
                        name="Password field does not accept empty value",
                        type="negative",
                        priority="high",
                        steps=[
                            GeneratedStep(order=1, action="navigate", value=url),
                            GeneratedStep(order=2, action="type", target=password.get("selector"), value=""),
                            GeneratedStep(order=3, action="submit", target=submit_target),
                            GeneratedStep(order=4, action="assert", target=password.get("selector"), expected=":invalid"),
                        ],
                        expectedResult="The form should not submit with an empty password.",
                        confidence=0.88,
                    )
                )
            for field in required_fields[:3]:
                label = field.get("label") or field.get("name") or field.get("id") or "required field"
                if field is email or field is password:
                    continue
                tests.append(
                    GeneratedTest(
                        name=f"Required {label} cannot be empty",
                        type="validation",
                        priority="high",
                        steps=[
                            GeneratedStep(order=1, action="navigate", value=url),
                            GeneratedStep(order=2, action="type", target=field.get("selector"), value=""),
                            GeneratedStep(order=3, action="submit", target=submit_target),
                            GeneratedStep(order=4, action="assert", target=field.get("selector"), expected=":invalid"),
                        ],
                        expectedResult=f"{label} stays invalid when left empty.",
                        confidence=0.91,
                    )
                )
            if text_inputs:
                field = text_inputs[0]
                tests.append(
                    GeneratedTest(
                        name=f"Boundary: very long value in {field.get('name') or field.get('id') or 'input'}",
                        type="boundary",
                        priority="medium",
                        steps=[
                            GeneratedStep(order=1, action="navigate", value=url),
                            GeneratedStep(order=2, action="type", target=field.get("selector"), value="A" * 512),
                            GeneratedStep(order=3, action="assert", target=field.get("selector")),
                        ],
                        expectedResult="The field should constrain or gracefully handle an oversized value.",
                        confidence=0.72,
                    )
                )

            buttons = [e for e in elements if e.get("tag") == "button" or e.get("role") == "button"]
            if buttons and not skip_generic and focus_mode != "validation":
                tests.append(
                    GeneratedTest(
                        name=f"Activate primary action on {title}",
                        type="functional",
                        priority="medium",
                        steps=[
                            GeneratedStep(order=1, action="navigate", value=url),
                            GeneratedStep(order=2, action="click", target=buttons[0].get("selector")),
                        ],
                        expectedResult="The primary action completes without an unhandled application error.",
                        confidence=0.7,
                    )
                )

        if not skip_generic and focus_mode == "full":
            tests.append(
                GeneratedTest(
                    name="Session refresh keeps the user in the authorized application",
                    type="session",
                    priority="medium",
                    steps=[
                        GeneratedStep(order=1, action="navigate", value=(pages[0].get("url") if pages else "")),
                        GeneratedStep(order=2, action="wait", value="500"),
                        GeneratedStep(order=3, action="assert", value=(pages[0].get("url") if pages else "")),
                    ],
                    expectedResult="Refreshing the authorized start URL still renders the application.",
                    confidence=0.8,
                )
            )

        brief_texts = {case.strip() for case in custom_cases}
        for requirement in request.requirements[:8]:
            text = requirement.get("text") if isinstance(requirement, dict) else str(requirement)
            if text.strip() in brief_texts:
                continue
            tests.append(
                GeneratedTest(
                    name=f"Requirement: {text[:70]}",
                    description=text,
                    type="functional",
                    priority=(requirement.get("priority") if isinstance(requirement, dict) else "high") or "high",
                    steps=[
                        GeneratedStep(order=1, action="navigate", value=(pages[0].get("url") if pages else "")),
                        GeneratedStep(order=2, action="assert", expected=None),
                    ],
                    expectedResult=text,
                    confidence=0.66,
                )
            )

        return TestGenerationResponse(
            tests=tests[:max_tests],
            provider=self.name,
            model=self.model,
            tokenUsage={"input": 0, "output": 0, "total": 0},
        )

    def analyze_bug(self, request: BugAnalysisRequest) -> BugAnalysisResponse:
        result = request.result or {}
        test = request.test or {}
        message = str((result.get("error") or {}).get("message") or result.get("actualResult") or "")
        lower = message.lower()
        api_500 = any(int(item.get("status") or 0) >= 500 for item in request.apiEvidence)

        if "unauthorized domain" in lower or "blocked navigation" in lower:
            return BugAnalysisResponse(
                isBug=False,
                confidence=0.99,
                title="Domain restriction prevented navigation",
                expected="Stay within authorized domains",
                actual=message,
                rootCause="Safety control, not an application defect.",
                provider=self.name,
                model=self.model,
            )
        if any(token in lower for token in ["net::", "timeout", "ns_error", "err_connection"]):
            return BugAnalysisResponse(
                isBug=False,
                confidence=0.84,
                title="Network or environment issue",
                expected="Application reachable",
                actual=message,
                rootCause="The failure looks like connectivity or environment instability.",
                provider=self.name,
                model=self.model,
            )
        if api_500:
            return BugAnalysisResponse(
                isBug=True,
                confidence=0.96,
                severity="high",
                category="api",
                title=f"{test.get('name') or 'Request'} caused a server error",
                expected="The API should return a controlled validation or success response.",
                actual="A 5xx response was captured during the user flow.",
                rootCause="Backend error handling or missing validation.",
                reproductionSteps=[f"{s.get('action')} {s.get('target') or ''} {s.get('value') or ''}".strip() for s in test.get("steps") or []],
                provider=self.name,
                model=self.model,
            )
        if "strict mode violation" in lower or "locator" in lower:
            return BugAnalysisResponse(
                isBug=False,
                confidence=0.74,
                title="Selector or test stability issue",
                expected=test.get("expectedResult"),
                actual=message,
                rootCause="The generated selector may be brittle. Treat as a test failure until reproduced as a product defect.",
                provider=self.name,
                model=self.model,
            )
        return BugAnalysisResponse(
            isBug=True,
            confidence=0.78,
            severity="medium",
            category="functional",
            title=test.get("name") or "Unexpected application failure",
            expected=test.get("expectedResult") or "The action should succeed",
            actual=message or "The expected result was not observed.",
            rootCause="The application did not satisfy the generated expectation after a real user action.",
            reproductionSteps=[f"{s.get('action')} {s.get('target') or ''} {s.get('value') or ''}".strip() for s in test.get("steps") or []],
            provider=self.name,
            model=self.model,
        )

    def analyze_content(self, request: ContentAnalysisRequest) -> ContentAnalysisResponse:
        issues: List[ContentIssue] = []
        labels: Dict[str, List[str]] = defaultdict(list)
        for el in request.elements:
            text = (el.text or "").strip()
            if not text:
                continue
            if BROKEN_RE.search(text):
                issues.append(
                    ContentIssue(
                        type="broken_text",
                        currentText=text,
                        suggestedText="Replace the broken runtime value with user-facing copy.",
                        confidence=0.97,
                        severity="high",
                        selector=el.selector,
                        tag=el.tag,
                        explanation="Visible text contains a runtime artifact.",
                    )
                )
            if PLACEHOLDER_RE.search(text):
                issues.append(
                    ContentIssue(
                        type="placeholder",
                        currentText=text,
                        suggestedText="Replace placeholder copy with production text.",
                        confidence=0.95,
                        severity="medium",
                        selector=el.selector,
                        tag=el.tag,
                    )
                )
            for typo, suggestion in COMMON_TYPOS.items():
                if re.search(rf"\b{typo}\b", text, re.I):
                    issues.append(
                        ContentIssue(
                            type="spelling",
                            currentText=text,
                            suggestedText=suggestion,
                            confidence=0.99,
                            severity="low",
                            selector=el.selector,
                            tag=el.tag,
                        )
                    )
            for pattern, issue_type, explanation in GRAMMAR_RE:
                if pattern.search(text) and len(text.split()) > 1:
                    issues.append(
                        ContentIssue(
                            type=issue_type,
                            currentText=text,
                            suggestedText=None,
                            confidence=0.72,
                            severity="low",
                            selector=el.selector,
                            tag=el.tag,
                            explanation=explanation,
                        )
                    )
            key = re.sub(r"[^a-z]+", "", text.lower())
            if key:
                labels[key].append(text)
        for values in labels.values():
            unique = sorted(set(values))
            if len(unique) > 1:
                issues.append(
                    ContentIssue(
                        type="inconsistent_label",
                        currentText=unique[0],
                        suggestedText=unique[1],
                        confidence=0.7,
                        severity="low",
                        explanation="Similar labels use inconsistent wording.",
                    )
                )
        return ContentAnalysisResponse(issues=issues[:40], provider=self.name, model=self.model)

    def detect_duplicates(self, request: DuplicateDetectionRequest) -> DuplicateDetectionResponse:
        groups: List[DuplicateGroup] = []
        buckets: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for bug in request.bugs:
            key = f"{bug.get('category')}|{bug.get('page')}|{(bug.get('rootCause') or bug.get('title') or '')[:40].lower()}"
            buckets[key].append(bug)
        for items in buckets.values():
            if len(items) < 2:
                continue
            primary = items[0]
            groups.append(
                DuplicateGroup(
                    primaryBugId=str(primary.get("id")),
                    duplicateBugIds=[str(item.get("id")) for item in items[1:]],
                    confidence=0.9,
                    reason="Same root cause and same affected workflow.",
                )
            )
        return DuplicateDetectionResponse(groups=groups, provider=self.name, model=self.model)

    def analyze_risk(self, request: RiskAnalysisRequest) -> dict:
        stats = request.statistics or {}
        bugs = int(stats.get("bugs") or 0)
        critical = int(stats.get("criticalBugs") or 0)
        risk = "low"
        if critical or bugs >= 5:
            risk = "high"
        elif bugs:
            risk = "medium"
        return {
            "risk": risk,
            "summary": f"Current run produced {bugs} confirmed bugs ({critical} critical).",
            "provider": self.name,
            "model": self.model,
        }

    def analyze_visual(self, request: VisualAnalysisRequest) -> dict:
        return {
            "supported": False,
            "summary": "Visual analysis is available when a vision-capable provider is configured.",
            "pageUrl": request.pageUrl,
            "provider": self.name,
            "model": self.model,
        }
