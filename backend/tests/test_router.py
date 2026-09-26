import pytest
from app.db.repository import create_task, get_task_history
from app.db.session import async_session_factory
from app.orchestration.router_node import _classify_offline, classify_and_route
from app.orchestration.state import TaskState


@pytest.mark.asyncio
async def test_classify_offline_keywords():
    """Verifies deterministic router assigns appropriate agents with high confidence."""
    # Calendar
    cal_res = _classify_offline("Schedule a 30-minute sync with John on Wednesday")
    assert cal_res["agent_id"] == "calendar_agent"
    assert cal_res["confidence"] >= 0.90

    # Email
    email_res = _classify_offline("Draft an email to the investors regarding Q3 metrics")
    assert email_res["agent_id"] == "email_agent"
    assert email_res["confidence"] >= 0.90

    # Search
    search_res = _classify_offline("Research competitive analysis for AI agents in 2026")
    assert search_res["agent_id"] == "search_agent"
    assert search_res["confidence"] >= 0.85


@pytest.mark.asyncio
async def test_low_confidence_fallback_to_custom_agent():
    """
    CRITICAL REQUIREMENT:
    If confidence < 0.6, do NOT guess — route to custom_agent as deliberate fallback.
    """
    vague_res = _classify_offline("do something vague")
    assert vague_res["confidence"] < 0.60

    async with async_session_factory() as session:
        task = await create_task(session, description="do something vague")

    state = TaskState(
        task_id=str(task.id),
        description="do something vague",
        status="received",
    )

    update = await classify_and_route(state)
    assert update["current_agent"] == "custom_agent"
    assert "Deliberate fallback to custom_agent" in update["route_reason"]

    # Verify task_events record in DB
    async with async_session_factory() as session:
        events = await get_task_history(session, task.id)
        routed_event = [e for e in events if e.event_type == "task.routed"][0]
        assert routed_event.to_agent_id == "custom_agent"
        assert routed_event.payload["agent_id"] == "custom_agent"
        assert routed_event.payload["confidence"] < 0.60
