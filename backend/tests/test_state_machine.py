import pytest
from app.db.repository import create_task, get_task, get_task_history, record_task_event
from app.db.session import async_session_factory
from app.orchestration.graph import (
    resume_from_blocked,
    run_task_graph,
)


@pytest.mark.asyncio
async def test_linear_calendar_task_execution():
    """Tests complete linear task lifecycle: received -> routed -> completed."""
    async with async_session_factory() as session:
        task = await create_task(
            session, description="Schedule meeting with project leads tomorrow at 10 AM"
        )
        task_id = str(task.id)

    final_state = await run_task_graph(task_id, task.description)
    assert final_state.status == "completed"
    assert final_state.current_agent == "calendar_agent"

    # Verify database state
    async with async_session_factory() as session:
        refreshed_task = await get_task(session, task.id)
        assert refreshed_task.status == "completed"
        assert refreshed_task.completed_at is not None

        events = await get_task_history(session, task.id)
        event_types = [e.event_type for e in events]
        assert "task.routed" in event_types
        assert "task.completed" in event_types

        # Verify sequence numbers are monotonic
        seqs = [e.sequence_no for e in events]
        assert seqs == sorted(seqs)
        assert len(seqs) == len(set(seqs))


@pytest.mark.asyncio
async def test_multi_agent_handoff_flow():
    """
    Tests cross-domain task triggering dynamic handoff between agents.
    SearchAgent completes research and explicitly hands off to EmailAgent.
    """
    description = (
        "Conduct competitive research on LLM orchestration, and email the report to the VP"
    )
    async with async_session_factory() as session:
        task = await create_task(session, description=description)
        task_id = str(task.id)

    final_state = await run_task_graph(task_id, description)
    assert final_state.status == "completed"

    async with async_session_factory() as session:
        events = await get_task_history(session, task.id)
        handoff_events = [e for e in events if e.event_type == "task.handoff"]
        assert len(handoff_events) >= 1

        handoff = handoff_events[0]
        assert handoff.from_agent_id == "search_agent"
        assert handoff.to_agent_id == "email_agent"
        assert handoff.reason is not None and len(handoff.reason) > 5
        assert handoff.payload["from_agent"] == "search_agent"
        assert handoff.payload["to_agent"] == "email_agent"


@pytest.mark.asyncio
async def test_blocked_task_and_retry_escalation():
    """
    Tests blocked task detection and retry escalation mechanism:
    - Missing scheduling date pauses graph in BLOCKED state.
    - resume_from_blocked re-enters the graph at blocked agent for 1st retry.
    - Cap at 2 retries, escalating to custom_agent.
    """
    description = "Book conference room Alpha (unscheduled date and time)"
    async with async_session_factory() as session:
        task = await create_task(session, description=description)
        task_id = str(task.id)

    # 1. Run graph - pauses at BLOCKED
    final_state = await run_task_graph(task_id, description)
    assert final_state.status == "blocked"

    async with async_session_factory() as session:
        refreshed_task = await get_task(session, task.id)
        assert refreshed_task.status == "blocked"

        events = await get_task_history(session, task.id)
        blocked_events = [e for e in events if e.event_type == "task.blocked"]
        assert len(blocked_events) == 1
        assert "Missing" in blocked_events[0].reason

    # 2. First retry (retry_count=1): re-enters blocked agent
    first_retry = await resume_from_blocked(task_id)
    assert first_retry.status == "blocked"

    # 3. Second retry (retry_count=2): hits retry cap -> escalates to custom_agent
    escalated_state = await resume_from_blocked(task_id)
    assert escalated_state.status in ["completed", "in_progress"]

    # Verify escalation handoff recorded
    async with async_session_factory() as session:
        events = await get_task_history(session, task.id)
        escalation_events = [
            e for e in events if e.event_type == "task.handoff" and e.to_agent_id == "custom_agent"
        ]
        assert len(escalation_events) >= 1
