# BugPilot AI

**Your AI QA Engineer**

BugPilot AI is a production-minded QA automation platform. Authorized QA engineers create a project, enter an application they are allowed to test, and an AI-assisted Playwright worker discovers the product, generates structured tests, captures UI / network / console evidence, and confirms real bugs — without treating every failed test as a defect.

## What you can do today

- Register, sign in, reset a password, and manage JWT access/refresh sessions
- Create projects scoped to **explicitly allowed domains**
- Start an asynchronous AI test run (`queued` immediately — the HTTP request does not block)
- Watch live progress over Server-Sent Events
- Persist pages, tests, APIs, screenshots, bugs, content, accessibility, performance, and AI audits in MongoDB
- Review dashboards, bug evidence, API detail, QA Health Score, and HTML/JSON reports

The first registered user becomes `admin`. Later users default to `qa_engineer`.

## Architecture

```
frontend (React / Vite)
        │  /api/v1
backend (Express / TypeScript)
        ├── MongoDB
        ├── Redis + BullMQ worker
        ├── automation (Playwright)
        └── ai-service (FastAPI, internal only)
```

The Python service is not public. It requires `X-BugPilot-Service-Key`.

AI providers are selected with `AI_PROVIDER`:

- `local` — deterministic heuristic provider (no LLM key required)
- `groq` / `groqcloud` — Groq Cloud (`llama-3.3-70b-versatile` by default)
- `openai` — OpenAI-compatible chat completions, with local fallback

Credentials stored on a project are encrypted at rest and decrypted only inside the test worker. They are never sent to the AI model.

## Local development

One command starts the UI, API, Groq AI service, and MongoDB:

```bash
./start.sh
```

Open http://localhost:5173 — leave that terminal open. Stop with Ctrl+C or `./stop.sh`.

Same thing via npm: `npm start`

### 1. Environment

```bash
cp .env.example .env
```

### 2. Infrastructure

```bash
docker compose up -d mongodb redis
```

### 3. Install

```bash
npm install
python3 -m pip install -r ai-service/requirements.txt
npx playwright install chromium
```

### 4. Run the four processes

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- AI service: http://localhost:8000 (internal)
- Worker: consumes the `test-runs` queue

Or start pieces individually:

```bash
npm run dev:infra
npm run dev -w backend
npm run worker -w backend
npm run dev -w frontend
npm run dev --prefix ai-service
```

## Testing an authorized application

1. Register at `/register`
2. Create a project at `/projects/new`
3. Enter a URL you own or are authorized to test
4. Confirm the authorization checkbox
5. Keep `allowedDomains` limited to that host
6. Click **Start AI Test**
7. Watch `/test-runs/:id` update from MongoDB + SSE

BugPilot will refuse to crawl hosts that are not on the project allow-list.

## Tests

```bash
npm test
```

This runs:

- Backend unit + API integration tests (MongoMemoryServer)
- Automation domain-restriction tests
- Frontend component tests
- AI schema / provider tests with the local heuristic provider (no live LLM calls)

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Services: `frontend`, `backend`, `worker`, `ai-service`, `mongodb`, `redis`.

## API contract

All public routes use `/api/v1`.

Success:

```json
{ "success": true, "data": {}, "meta": {} }
```

Error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid project URL" } }
```

## QA Health Score

BugPilot QA Health Score is a **product-defined heuristic**, not an industry standard. The dashboard always shows why the score changed (critical bugs, API failures, accessibility findings, pass rate, and so on).

## Security notes

- JWT access + refresh tokens
- bcrypt password hashing
- Project-level authorization
- Rate limiting and secure headers
- Secret masking for captured APIs
- Encrypted project login secrets
- Audit log collection
- Internal AI service authentication

Never point BugPilot at a site you are not authorized to test.
