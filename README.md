# EffiGov Take-Home

A minimal but complete demo of the EffiGov flow: a caller talks to a voice
agent, the agent files or looks up a case through a FastAPI backend, and a
Next.js dashboard shows the case live.

**Scope on purpose:** one workflow (report an issue / check on a case),
one data model (`Case`), done cleanly end to end, per the assignment's own
guidance to avoid spreading thin across features.

## Architecture

```
Caller (browser mic) --LiveKit room audio--> agent/agent.py
                                                  |
                                                  | HTTP (httpx)
                                                  v
                                          backend/app/main.py  --SQLite-->  effigov.db
                                                  |
                                                  | WebSocket broadcast (/ws/cases)
                                                  v
                                          frontend (Next.js dashboard)
```

- **backend/** — FastAPI + SQLModel + SQLite. Endpoints for create/list/get/
  update a case, a phone-number lookup used by the agent, and a `/ws/cases`
  websocket that broadcasts every change (stretch goal: live dashboard).
- **agent/** — A LiveKit Agents voice agent with three tools
  (`create_case`, `lookup_case_by_phone`, `update_case_status`) that call the
  backend over HTTP. This is the "backend action through a tool call"
  requirement.
- **frontend/** — Next.js dashboard: case list + case detail, with a
  websocket hook so changes from a live call appear without a refresh.

Already verified working in isolation:
- Backend: create → list → patch → phone-lookup round trip, tested live.
- Frontend: builds clean (`npm run build`, no TS/lint errors), served real
  case data from the backend in a live run.
- Agent: imports (`Agent`, `AgentSession`, `function_tool`, plugins) checked
  against the actual installed `livekit-agents` package, so the API surface
  is current, not just remembered from training data.

The only piece that needs *your* credentials to actually run is the voice
call itself (LiveKit + OpenAI + Deepgram keys) — that part can't be
exercised in this sandbox.

## Running it locally

### 1. Backend
```bash
cd backend
uv sync            # or: pip install -e .
uv run uvicorn app.main:app --reload --port 8000
```
Runs on http://localhost:8000. SQLite file `effigov.db` is created
automatically on first run.

### 2. Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```
Runs on http://localhost:3000.

### 3. Voice agent
```bash
cd agent
cp .env.example .env     # fill in LiveKit + OpenAI + Deepgram keys
uv sync                  # or: pip install -e .
uv run python agent.py console   # quick terminal-based test, no LiveKit room needed
# or:
uv run python agent.py dev       # connects to a real LiveKit room for a browser/mobile test call
```
The `console` mode is the fastest way to sanity-check the conversation and
tool calls without setting up a full room — good for your first pass.

## Design notes / tradeoffs

- **Why SQLModel over separate SQLAlchemy models + Pydantic schemas:** one
  entity, one file, less to keep in sync. If this grew past a handful of
  models I'd split them.
- **Why an in-memory websocket fan-out instead of polling:** the stretch
  goal explicitly asks for real-time updates; a single-process in-memory
  list of connections is the simplest thing that works for one backend
  instance. It would not survive multiple backend replicas — that's the
  known limit, called out in `main.py`.
- **Why the agent only has 3 tools:** matches the "pick one narrow flow"
  advice. `update_case_status` exists mainly so a staff member (or you, on
  the debrief call) can test the update path without hand-editing SQLite.
- **What I'd add next if time allowed:** a call-summary tool that runs
  after hangup, and streaming partial transcripts into the case detail
  page (the data model — a `notes` field already used for saving text —
  makes this a small extension, not a rearchitecture).

## Repo layout
```
effigov-demo/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI app, endpoints, websocket
│   │   ├── models.py     # SQLModel Case (table + create/update/read schemas)
│   │   └── db.py         # engine + session
│   └── pyproject.toml
├── agent/
│   ├── agent.py           # LiveKit voice agent + backend-calling tools
│   ├── .env.example
│   └── pyproject.toml
└── frontend/
    ├── src/app/page.tsx           # case list dashboard
    ├── src/app/cases/[id]/page.tsx # case detail + status/notes editor
    ├── src/lib/api.ts             # typed backend client
    ├── src/lib/useCaseEvents.ts   # websocket hook for live updates
    └── .env.local.example
```
