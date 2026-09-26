import json
import pytest
from httpx import ASGITransport, AsyncClient

from app.db.repository import create_task, get_task_history, record_task_event
from app.db.session import async_session_factory
from app.events.event_schemas import (
    TaskBlockedPayload,
    TaskCompletedPayload,
    TaskCreatedPayload,
    TaskHandoffPayload,
    TaskRoutedPayload,
)
from app.main import app


@pytest.mark.asyncio
async def test_event_schema_contract_compliance():
    """
    Validates that each event payload conforms EXACTLY to the frontend contract:
      task.created   { task_id, description, sequence_no }
      task.routed    { task_id, agent_id, confidence, reason, sequence_no }
      task.handoff   { task_id, from_agent, to_agent, reason, sequence_no }
      task.blocked   { task_id, agent_id, reason, sequence_no }
      task.completed { task_id, duration_ms, sequence_no }
    """
    dummy_task_id = "11111111-2222-3333-4444-555555555555"

    # 1. task.created
    created = TaskCreatedPayload(
        task_id=dummy_task_id,
        description="Test task description",
        sequence_no=1,
    )
    c_dict = created.model_dump()
    assert "task_id" in c_dict and c_dict["task_id"] == dummy_task_id
    assert "description" in c_dict and c_dict["description"] == "Test task description"
    assert "sequence_no" in c_dict and c_dict["sequence_no"] == 1

    # 2. task.routed
    routed = TaskRoutedPayload(
        task_id=dummy_task_id,
        agent_id="calendar_agent",
        confidence=0.95,
        reason="Scheduling detected",
        sequence_no=2,
    )
    r_dict = routed.model_dump()
    assert r_dict["agent_id"] == "calendar_agent"
    assert isinstance(r_dict["confidence"], float)
    assert r_dict["reason"] == "Scheduling detected"
    assert r_dict["sequence_no"] == 2

    # 3. task.handoff
    handoff = TaskHandoffPayload(
        task_id=dummy_task_id,
        from_agent="search_agent",
        to_agent="email_agent",
        reason="Handing off to send research email",
        sequence_no=3,
    )
    h_dict = handoff.model_dump()
    assert h_dict["from_agent"] == "search_agent"
    assert h_dict["to_agent"] == "email_agent"
    assert h_dict["reason"] == "Handing off to send research email"
    assert h_dict["sequence_no"] == 3

    # 4. task.blocked
    blocked = TaskBlockedPayload(
        task_id=dummy_task_id,
        agent_id="calendar_agent",
        reason="Missing meeting time",
        sequence_no=4,
    )
    b_dict = blocked.model_dump()
    assert b_dict["agent_id"] == "calendar_agent"
    assert b_dict["reason"] == "Missing meeting time"
    assert b_dict["sequence_no"] == 4

    # 5. task.completed
    completed = TaskCompletedPayload(
        task_id=dummy_task_id,
        duration_ms=1850,
        sequence_no=5,
    )
    done_dict = completed.model_dump()
    assert done_dict["duration_ms"] == 1850
    assert done_dict["sequence_no"] == 5


@pytest.mark.asyncio
async def test_atomic_sequence_generation_in_repository():
    """
    Verifies that record_task_event assigns strictly monotonic sequence numbers
    (1, 2, 3...) per task without duplicate or out-of-order sequence numbers.
    """
    async with async_session_factory() as session:
        task = await create_task(session, description="Sequence testing task")
        task_id = task.id

        e1 = await record_task_event(
            session=session,
            task_id=task_id,
            event_type="task.created",
            payload={"task_id": str(task_id), "description": task.description},
        )
        assert e1.sequence_no == 1
        assert e1.payload["sequence_no"] == 1

        e2 = await record_task_event(
            session=session,
            task_id=task_id,
            event_type="task.routed",
            payload={"task_id": str(task_id), "agent_id": "email_agent", "confidence": 0.9, "reason": "Emailing"},
            to_agent_id="email_agent",
        )
        assert e2.sequence_no == 2
        assert e2.payload["sequence_no"] == 2

        e3 = await record_task_event(
            session=session,
            task_id=task_id,
            event_type="task.completed",
            payload={"task_id": str(task_id), "duration_ms": 1500},
        )
        assert e3.sequence_no == 3
        assert e3.payload["sequence_no"] == 3

        history = await get_task_history(session, task_id)
        assert len(history) == 3
        assert [h.sequence_no for h in history] == [1, 2, 3]


@pytest.mark.asyncio
async def test_rest_api_reconnect_sync():
    """
    Verifies the reconnection pattern:
    Frontend calls GET /tasks/{id} to re-sync full state and event history.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create task via API
        create_resp = await client.post(
            "/tasks",
            json={"description": "Test task for API sync"},
        )
        assert create_resp.status_code == 201
        data = create_resp.json()
        task_id = data["task_id"]
        assert task_id is not None
        assert data["status"] == "received"

        # Query GET /tasks/{id} (reconnecting client state re-sync)
        sync_resp = await client.get(f"/tasks/{task_id}")
        assert sync_resp.status_code == 200
        sync_data = sync_resp.json()
        assert sync_data["task"]["id"] == task_id
        assert len(sync_data["events"]) >= 1

        # Check list endpoint
        list_resp = await client.get("/tasks")
        assert list_resp.status_code == 200
        assert len(list_resp.json()) >= 1

        # Check orchestration graph export endpoint
        graph_resp = await client.get("/orchestration/graph")
        assert graph_resp.status_code == 200
        assert graph_resp.json()["format"] == "mermaid"
        assert "classify_and_route" in graph_resp.json()["diagram"]
