from app.providers.local import LocalHeuristicProvider
from app.schemas.contracts import (
    BugAnalysisRequest,
    ContentAnalysisRequest,
    ContentElement,
    DuplicateDetectionRequest,
    FocusBrief,
    TestGenerationRequest,
)


def test_generates_structured_tests_from_discovered_context():
    provider = LocalHeuristicProvider()
    result = provider.generate_tests(
        TestGenerationRequest(
            projectId="p1",
            applicationContext={
                "pages": [
                    {
                        "url": "https://demo.bugpilot.test/login",
                        "title": "Login",
                        "elements": [
                            {"tag": "input", "inputType": "email", "selector": "#email"},
                            {"tag": "input", "inputType": "password", "selector": "#password"},
                            {"tag": "button", "type": "submit", "selector": "button", "text": "Sign in"},
                        ],
                    }
                ]
            },
            requirements=[{"text": "Reject invalid email", "priority": "high"}],
            limits={"maxTests": 20},
        )
    )
    assert result.tests
    assert all(test.steps for test in result.tests)
    assert any(test.type == "validation" for test in result.tests)


def test_uses_developer_brief_as_required_cases():
    provider = LocalHeuristicProvider()
    result = provider.generate_tests(
        TestGenerationRequest(
            projectId="p1",
            applicationContext={
                "pages": [
                    {
                        "url": "https://demo.bugpilot.test/signup",
                        "title": "Signup",
                        "elements": [{"tag": "input", "inputType": "email", "selector": "#email"}],
                    }
                ]
            },
            brief=FocusBrief(
                focusMode="validation",
                focusPages=["https://demo.bugpilot.test/signup"],
                instructions="Check required name and invalid email",
                customCases=["Submit empty form -> show field errors"],
            ),
            limits={"maxTests": 20},
        )
    )
    names = " ".join(test.name for test in result.tests)
    assert "empty form" in names.lower() or "required name" in names.lower()
    assert not any(test.type == "session" for test in result.tests)


def test_does_not_treat_network_failures_as_bugs():
    provider = LocalHeuristicProvider()
    result = provider.analyze_bug(
        BugAnalysisRequest(
            projectId="p1",
            testRunId="r1",
            test={"name": "Open login", "expectedResult": "Login loads", "steps": []},
            result={"error": {"message": "net::ERR_CONNECTION_REFUSED"}},
        )
    )
    assert result.isBug is False


def test_flags_spelling_and_placeholder_content():
    provider = LocalHeuristicProvider()
    result = provider.analyze_content(
        ContentAnalysisRequest(
            projectId="p1",
            testRunId="r1",
            pageUrl="https://demo.bugpilot.test/checkout",
            elements=[
                ContentElement(selector="#address", text="Adress"),
                ContentElement(selector="p", text="Lorem ipsum dolor"),
                ContentElement(selector="h2", text="Open a application"),
            ],
        )
    )
    types = {issue.type for issue in result.issues}
    assert "spelling" in types
    assert "placeholder" in types
    assert "grammar" in types


def test_groups_duplicate_root_causes():
    provider = LocalHeuristicProvider()
    result = provider.detect_duplicates(
        DuplicateDetectionRequest(
            projectId="p1",
            testRunId="r1",
            bugs=[
                {"id": "bug_1", "title": "Checkout qty", "category": "validation", "page": "/checkout", "rootCause": "missing qty validation"},
                {"id": "bug_5", "title": "Negative qty", "category": "validation", "page": "/checkout", "rootCause": "missing qty validation"},
            ],
        )
    )
    assert result.groups
    assert result.groups[0].primaryBugId == "bug_1"
    assert "bug_5" in result.groups[0].duplicateBugIds
