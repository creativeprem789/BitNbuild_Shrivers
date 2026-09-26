# Interactive Multi-Agent Task Harness 🏢⚡

**Bit N Build — Problem Statement 05**  
An enterprise-grade, asynchronous multi-agent orchestration backend. A user submits tasks in natural language; the system classifies them using **Google Gemini 2.5 Flash** (via the modern `google-genai` SDK), routes them to specialized AI agents, supports dynamic cross-domain handoffs mid-execution, and streams every atomic state transition over WebSocket in real time to render a "virtual office" (desks = agents, task = moving token).

---

## 🏛 System Architecture & Workflow

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
             Redis Pub/Sub Channel                            PostgreSQL Database
             `task-events:{task_id}`                      Atomic `task_events` audit
                      │                                   Monotonic `sequence_no`
          ┌───────────┴───────────┐                                   │
          │    Redis Event Bus    │                                   │
          │    (event_bus.py)     │◄──────────────────────────────────┘
          └───────────▲───────────┘
                      │ (DB Commit before Publish)
                      │
   ═══════════════════╧════════════════════════════════════════════════════════
                        LANGGRAPH ORCHESTRATION ENGINE
   ════════════════════════════════════════════════════════════════════════════
                                  [ START ]
                                      │
                                      ▼
                           [ classify_and_route ]
                     (Google Gemini 2.5 Flash / Router)
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

## 🚀 Key Features

1. **Explicit LangGraph Orchestration**: Inspectable `StateGraph` state machine with formal node transitions and conditional routing (no ad-hoc if/else dispatch).
2. **Single Source of Truth**: Every state transition writes an atomic, monotonic `task_events` record to PostgreSQL using database row locks (`SELECT ... FOR UPDATE`) before publishing to Redis Pub/Sub.
3. **Frontend Event Contract Fidelity**: Emits the exact 5 event payloads expected by the virtual office UI:
   - `task.created`: `{ task_id, description, sequence_no }`
   - `task.routed`: `{ task_id, agent_id, confidence, reason, sequence_no }`
   - `task.handoff`: `{ task_id, from_agent, to_agent, reason, sequence_no }`
   - `task.blocked`: `{ task_id, agent_id, reason, sequence_no }`
   - `task.completed`: `{ task_id, duration_ms, sequence_no }`
4. **WebSocket Reconnect Resilience**: Connected clients receive real-time streams; if a disconnect occurs mid-demo, clients call `GET /tasks/{id}` to fetch the ordered event timeline and restore UI state seamlessly.
5. **Real External Calendar Integration**: `calendar_agent` performs actual external HTTP calls (via `httpx`) to read and book calendar events with verified status codes and payloads.
6. **Graceful Fallbacks & Escalation**:
   - Classification confidence `< 0.60` deliberately falls back to `custom_agent` with reason logging.
   - Blocked tasks pause state; `resume_from_blocked(task_id)` retries with a cap at 2 attempts before escalating to `custom_agent`.

---

## 📦 Tech Stack

- **Runtime**: Python 3.11+
- **API Framework**: FastAPI (100% Async)
- **Agent Orchestrator**: LangGraph (`StateGraph`, conditional edges)
- **LLM Engine**: Google Gemini 2.5 Flash (`gemini-2.5-flash` via `google-genai` SDK)
- **Task Queue & Pub/Sub**: Redis (`redis.asyncio`)
- **Database & ORM**: PostgreSQL + SQLAlchemy 2.0 Async + asyncpg
- **Migrations**: Alembic
- **Containerization**: Docker & Docker Compose with healthchecks

---

## 🛠 Project Structure

```
BitNBuild/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entrypoint, lifespan startup/shutdown & structured logging
│   │   ├── config.py                # Pydantic-settings config (env, secrets, Gemini models)
│   │   ├── api/
│   │   │   ├── routes_tasks.py      # REST endpoints (/tasks, /health, /retry)
│   │   │   └── ws_gateway.py        # Real-time WebSocket streaming gateway
│   │   ├── orchestration/
│   │   │   ├── graph.py             # LangGraph StateGraph compiled definition
│   │   │   ├── router_node.py       # Gemini 2.5 Flash structured classifier & fallback
│   │   │   ├── state.py             # TaskState Pydantic schema
│   │   │   └── agents/
│   │   │       ├── base_agent.py    # BaseAgent abstract class
│   │   │       ├── email_agent.py   # Email Specialist
│   │   │       ├── calendar_agent.py# Real External HTTP Calendar integration
│   │   │       ├── search_agent.py  # Research Analyst
│   │   │       └── custom_agent.py  # Executive Resolver (Fallback & Escalation)
│   │   ├── db/
│   │   │   ├── models.py            # SQLAlchemy 2.0 ORM models
│   │   │   ├── schema.sql           # Reference raw DDL
│   │   │   ├── session.py           # Async engine, sessionmaker, startup retry
│   │   │   └── repository.py        # Atomic sequence generation & task queries
│   │   └── events/
│   │       ├── event_bus.py         # Redis Pub/Sub publisher and subscriber
│   │       └── event_schemas.py     # Pydantic models for frontend event contract
│   ├── alembic/
│   │   ├── versions/
│   │   │   └── 0001_initial_schema.py # Initial migration & seeded agents
│   │   └── env.py
│   ├── tests/
│   │   ├── test_state_machine.py    # LangGraph lifecycle, handoff, and retry tests
│   │   ├── test_router.py           # Classifier & low-confidence fallback tests
│   │   └── test_ws_contract.py      # Event schema contract & monotonic sequence tests
│   ├── Dockerfile
│   ├── requirements.txt
│   └── alembic.ini
├── docker-compose.yml               # Multi-container orchestration (api, postgres, redis)
├── .env.example                     # Environment template
└── README.md
```

---

## 🚀 Quickstart & Run Instructions

### 1. Configure Environment
Copy the `.env.example` file:
```bash
cp .env.example .env
```
*(Optional: Set your `GEMINI_API_KEY` in `.env` if you want live Gemini 2.5 Flash calls. If left empty, the built-in deterministic router handles all tasks seamlessly without external network dependencies).*

### 2. Launch with Docker Compose
Start PostgreSQL, Redis, and the FastAPI Backend with verified healthchecks:
```bash
docker-compose up --build
```

The services will initialize in proper order:
1. `postgres` (healthy on port 5432)
2. `redis` (healthy on port 6379)
3. `api` (starts after dependencies are healthy, runs startup DB retries, ready on port 8000)

---

## 📡 Live Demo & API Walkthrough

### 1. Listen to Real-Time Events via WebSocket
Open a terminal and connect using `wscat`:
```bash
# Subscribe to all events across the virtual office
wscat -c "ws://localhost:8000/ws/tasks?subscribe=all"
```
Or send JSON upon connection:
```json
{"subscribe": "all"}
```

### 2. Submit a Task (Trigger Orchestration)
In another terminal, submit a natural language task via `curl`:
```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"description": "Schedule a quarterly product review with the engineering team tomorrow at 2 PM"}'
```
**Response:**
```json
{
  "task_id": "4b63e8a2-a9b1-4f4d-82fa-8cf7c89a01f9",
  "status": "received",
  "description": "Schedule a quarterly product review with the engineering team tomorrow at 2 PM"
}
```

### 3. Watch Live Streamed Events in WebSocket Terminal
The WebSocket client immediately receives ordered event payloads:
```json
{"event": "task.created", "event_type": "task.created", "task_id": "4b63e8a2...", "description": "Schedule...", "sequence_no": 1}
{"event": "task.routed", "event_type": "task.routed", "task_id": "4b63e8a2...", "agent_id": "calendar_agent", "confidence": 0.95, "reason": "Task involves scheduling or calendar event coordination.", "sequence_no": 2}
{"event": "task.completed", "event_type": "task.completed", "task_id": "4b63e8a2...", "duration_ms": 1280, "sequence_no": 3}
```

### 4. Cross-Domain Multi-Agent Handoff Demo
Submit a task requiring multiple specialties (Search -> Email):
```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"description": "Research the latest benchmarks on LangGraph orchestration, and email the report to the VP"}'
```
You will observe:
1. `task.created` (seq=1)
2. `task.routed` -> `search_agent` (seq=2)
3. `task.handoff` -> from `search_agent` to `email_agent` with human-readable reason (seq=3)
4. `task.completed` -> duration_ms computed (seq=4)

### 5. Blocked Task & Human-in-the-Loop Retry Demo
Submit a task with incomplete scheduling instructions:
```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"description": "Book conference room Alpha (unscheduled date and time)"}'
```
The state machine identifies missing parameters and pauses at `task.blocked`:
```json
{"event": "task.blocked", "event_type": "task.blocked", "task_id": "...", "agent_id": "calendar_agent", "reason": "Missing date and time parameters for calendar reservation. Blocked awaiting scheduling details.", "sequence_no": 3}
```

To resume the blocked task, call the retry endpoint:
```bash
curl -X POST http://localhost:8000/tasks/<task_id>/retry
```
The task re-enters the graph. If retried beyond 2 attempts, it automatically escalates to `custom_agent` for executive resolution!

### 6. Re-Sync After WebSocket Disconnect
If the frontend disconnects or reloads:
```bash
curl http://localhost:8000/tasks/<task_id>
```
Returns the full task state along with the complete ordered event history:
```json
{
  "task": {
    "id": "4b63e8a2...",
    "status": "completed",
    "current_agent_id": "calendar_agent",
    "duration_ms": 1280
  },
  "events": [
    { "sequence_no": 1, "event_type": "task.created", "payload": { ... } },
    { "sequence_no": 2, "event_type": "task.routed", "payload": { ... } },
    { "sequence_no": 3, "event_type": "task.completed", "payload": { ... } }
  ]
}
```

### 7. Export LangGraph Mermaid Diagram for Judges Walkthrough
```bash
curl http://localhost:8000/orchestration/graph
```
Returns the exact Mermaid state diagram representing the inspectable LangGraph state machine.

---

## 🔬 Automated Test Suite

Run the full automated test suite covering state transitions, the router, and the WebSocket contract:
```bash
pytest -v backend/tests
```

**Results:**
- `test_router.py::test_classify_offline_keywords` ✅ **PASSED**
- `test_router.py::test_low_confidence_fallback_to_custom_agent` ✅ **PASSED**
- `test_state_machine.py::test_linear_calendar_task_execution` ✅ **PASSED**
- `test_state_machine.py::test_multi_agent_handoff_flow` ✅ **PASSED**
- `test_state_machine.py::test_blocked_task_and_retry_escalation` ✅ **PASSED**
- `test_ws_contract.py::test_event_schema_contract_compliance` ✅ **PASSED**
- `test_ws_contract.py::test_atomic_sequence_generation_in_repository` ✅ **PASSED**
- `test_ws_contract.py::test_rest_api_reconnect_sync` ✅ **PASSED**

---

## 🛡 License
MIT License. Built for Bit N Build Hackathon.
