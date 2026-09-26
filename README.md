# Interactive Multi-Agent Task Harness 🏢⚡

**Bit N Build Hackathon — Problem Statement 05**  
An enterprise-grade, asynchronous multi-agent orchestration backend. A user submits tasks in natural language; the system classifies them using **Google Gemini Flash** (via the official `google-genai` SDK), routes them to specialized AI agents, supports dynamic cross-domain handoffs mid-execution, and streams every atomic state transition over WebSocket in real time to render a "virtual office" (desks = agents, task = moving token).

---

## 🏛 System Architecture

```
                                ┌───────────────────────────┐
                                │   Frontend Virtual Office │
                                │ (Desks = Agents, Tokens)  │
                                └─────────────┬─────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │ WebSocket Stream (ws://.../ws/tasks)          │
                      │ REST API & Re-sync (http://.../tasks/{id})    │
                      ▼                                               ▼
          ┌───────────────────────┐                       ┌───────────────────────┐
          │    FastAPI Gateway    │                       │  Re-sync & Timeline   │
          │   (ws_gateway.py)     │                       │  (routes_tasks.py)    │
          └───────────▲───────────┘                       └───────────┬───────────┘
                      │                                               │
             Event Bus (In-Memory /                   Supabase / PostgreSQL Cloud DB
              Redis Pub/Sub Channel)                  Atomic `task_events` audit log
             `task-events:{task_id}`                  Strict monotonic `sequence_no`
                      │                                               │
          ┌───────────┴───────────┐                                   │
          │  Resilient Event Bus  │                                   │
          │    (event_bus.py)     │◄──────────────────────────────────┘
          └───────────▲───────────┘
                      │ (DB Commit before Event Broadcast)
                      │
   ═══════════════════╧════════════════════════════════════════════════════════
                        LANGGRAPH ORCHESTRATION ENGINE
   ════════════════════════════════════════════════════════════════════════════
                                  [ START ]
                                      │
                                      ▼
                           [ classify_and_route ]
                    (Google Gemini Flash Router Node)
                       Confidence < 0.60 ──► custom_agent
                                      │
              ┌───────────────┬───────┴───────┬───────────────┐
              ▼               ▼               ▼               ▼
      [ email_agent ] [ calendar_agent ] [ search_agent ] [ custom_agent ]
      (Specialist)    (Real HTTP API)    (Research)       (Resolver)
              │               │               │               │
              │◄──────────────┴───────┬───────┴──────────────►│ (Handoffs)
              │                       │                       │
              ├───────────► [ BLOCKED: Awaiting Details ] ◄───┤
              │                       │ (resume_from_blocked) │
              │                       └───────────────────────┘
              ▼
         [ finalize ]
     (Duration, Completed)
              │
              ▼
           [ END ]
```

---

## 📦 Tech Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **API Framework** | **FastAPI** (Python 3.11+) | Async ASGI framework with native WebSocket support and automatic OpenAPI documentation. |
| **Agent Orchestration** | **LangGraph** (`StateGraph`) | Explicit, cyclic state machine with formal conditional transitions (no ad-hoc if/else dispatch). |
| **LLM Engine** | **Google Gemini Flash** (`google-genai` SDK) | Ultra-fast natural language task intent classification with structured JSON output and multi-model fallback (`gemini-flash-latest`, `gemini-3.8-flash`, `gemini-3.5-flash`). |
| **Database & ORM** | **Supabase / PostgreSQL** + **SQLAlchemy 2.0 Async** (`asyncpg`) | Production cloud persistence with row-level locks (`SELECT FOR UPDATE`), atomic monotonic sequence numbers, and zero-config local SQLite fallback. |
| **Real-time Event Bus** | **Async Pub/Sub Event Bus** (`asyncio.Queue` / **Redis**) | Zero-latency internal event streaming for single-instance hackathon demos, plus Redis adapter for multi-worker distributed setups. |
| **Calendar Integration** | **HTTPX Async Client** | Live external REST sandbox integration for checking calendar conflicts and booking meetings. |
| **Testing** | **Pytest** + **pytest-asyncio** + **HTTPX ASGITransport** | 100% automated test coverage across router, state transitions, and WebSocket event contract compliance. |

---

## 🛠 Detailed Folder Structure

```
BitNBuild/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entrypoint, lifespan startup/shutdown & structured logging
│   │   ├── config.py                # Pydantic-settings config (env, secrets, Gemini models, DB normalization)
│   │   ├── api/
│   │   │   ├── routes_tasks.py      # REST endpoints (POST /tasks, GET /tasks/{id}, /health, /retry)
│   │   │   ├── ws_gateway.py        # Real-time WebSocket streaming gateway (ws://.../ws/tasks)
│   │   │   └── schemas.py           # Pydantic request/response schemas
│   │   ├── orchestration/
│   │   │   ├── graph.py             # LangGraph StateGraph compiled state machine & node handlers
│   │   │   ├── router_node.py       # Gemini Flash structured classifier & deterministic rule fallback
│   │   │   ├── state.py             # TaskState schema (task_id, description, status, current_agent, retry_count)
│   │   │   └── agents/
│   │   │       ├── base_agent.py    # BaseAgent abstract class
│   │   │       ├── email_agent.py   # Email Specialist (triages and composes email communications)
│   │   │       ├── calendar_agent.py# Calendar Coordinator (real external HTTP API calls)
│   │   │       ├── search_agent.py  # Research Analyst (fact-finding and data synthesis)
│   │   │       └── custom_agent.py  # Executive Resolver (multi-domain workflows, fallback & escalation)
│   │   ├── db/
│   │   │   ├── models.py            # SQLAlchemy 2.0 ORM models (Agent, Task, TaskEvent)
│   │   │   ├── schema.sql           # Reference raw PostgreSQL DDL
│   │   │   ├── session.py           # Async engine, connection pooling, and startup auto-seeding
│   │   │   └── repository.py        # Atomic sequence generation (seq=1, 2, 3...) & DB queries
│   │   └── events/
│   │       ├── event_bus.py         # Resilient event bus (In-Memory PubSub + Redis Pub/Sub)
│   │       └── event_schemas.py     # Pydantic models for frontend event contract compliance
│   ├── alembic/
│   │   ├── versions/
│   │   │   └── 0001_initial_schema.py # Initial migration & seeded agents
│   │   └── env.py
│   ├── tests/
│   │   ├── conftest.py              # Test database engine, mocked Redis, and isolated test fixtures
│   │   ├── test_state_machine.py    # LangGraph lifecycle, handoff, and retry tests
│   │   ├── test_router.py           # Gemini classifier & low-confidence fallback tests
│   │   └── test_ws_contract.py      # Event schema contract & monotonic sequence tests
│   ├── Dockerfile                   # Production container definition
│   ├── requirements.txt             # Python dependencies (fastapi, langgraph, google-genai, greenlet, asyncpg)
│   └── alembic.ini
├── docker-compose.yml               # Multi-container orchestration (api, postgres, redis)
├── .env.example                     # Environment configuration template
├── .gitignore                       # Git ignore rules (protects .env and local db files)
└── README.md                        # Project documentation
```

---

## 📑 Frontend Event Contract (Virtual Office)

The backend streams events over WebSocket (`/ws/tasks?subscribe=all`) with **strictly monotonic sequence numbers** per task (`sequence_no: 1, 2, 3...`) matching the exact contract expected by the virtual office UI:

| Event Type | Trigger | Payload Shape |
| :--- | :--- | :--- |
| `task.created` | Task submitted via REST API | `{ "event": "task.created", "task_id": "...", "description": "...", "sequence_no": 1 }` |
| `task.routed` | Router classifies & assigns agent | `{ "event": "task.routed", "task_id": "...", "agent_id": "calendar_agent", "confidence": 0.95, "reason": "...", "sequence_no": 2 }` |
| `task.handoff` | Mid-execution cross-agent delegation | `{ "event": "task.handoff", "task_id": "...", "from_agent": "search_agent", "to_agent": "email_agent", "reason": "...", "sequence_no": 3 }` |
| `task.blocked` | Missing parameters / external issue | `{ "event": "task.blocked", "task_id": "...", "agent_id": "calendar_agent", "reason": "...", "sequence_no": 3 }` |
| `task.completed`| Execution successfully finalized | `{ "event": "task.completed", "task_id": "...", "duration_ms": 1420, "sequence_no": 4 }` |

---

## ⚡ Quickstart: Running the Backend

### 1. Environment Setup
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
ROUTER_MODEL=gemini-flash-latest
AGENT_MODEL=gemini-flash-latest

# Database (Supabase PostgreSQL Cloud DB or local SQLite)
DATABASE_URL=postgresql+asyncpg://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Redis (Leave blank to use zero-latency In-Memory Event Bus)
REDIS_URL=
```

### 2. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 3. Start the Server
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The service will be live at:
* **Interactive API Documentation (Swagger)**: `http://localhost:8000/docs`
* **Health Check**: `http://localhost:8000/health`
* **WebSocket Endpoint**: `ws://localhost:8000/ws/tasks?subscribe=all`
* **Orchestration Mermaid Graph**: `http://localhost:8000/orchestration/graph`

---

## 🔬 Automated Testing & Verification

Run the full automated test suite covering LangGraph state transitions, router classification, low-confidence fallback, and WebSocket schema contracts:

```bash
cd backend
pytest -v
```

### Test Suite Summary:
* `test_router.py::test_classify_offline_keywords` ✅ **PASSED**
* `test_router.py::test_low_confidence_fallback_to_custom_agent` ✅ **PASSED**
* `test_state_machine.py::test_linear_calendar_task_execution` ✅ **PASSED**
* `test_state_machine.py::test_multi_agent_handoff_flow` ✅ **PASSED**
* `test_state_machine.py::test_blocked_task_and_retry_escalation` ✅ **PASSED**
* `test_ws_contract.py::test_event_schema_contract_compliance` ✅ **PASSED**
* `test_ws_contract.py::test_atomic_sequence_generation_in_repository` ✅ **PASSED**
* `test_ws_contract.py::test_rest_api_reconnect_sync` ✅ **PASSED**

**8 of 8 tests passing (100% pass rate).**

---

## 🛡 License
MIT License. Built for Bit N Build Hackathon (Problem Statement 05).
