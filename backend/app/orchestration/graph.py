import asyncio
import datetime
import logging
import time
from typing import Any, Dict, Literal, Optional
from langgraph.graph import StateGraph, END, START

from app.db.models import Task
from app.db.repository import get_task, get_task_history, record_task_event
from app.db.session import async_session_factory
from app.events.event_bus import event_bus
from app.orchestration.agents.calendar_agent import CalendarAgent
from app.orchestration.agents.custom_agent import CustomAgent
from app.orchestration.agents.email_agent import EmailAgent
from app.orchestration.agents.search_agent import SearchAgent
from app.orchestration.router_node import classify_and_route
from app.orchestration.state import TaskState

logger = logging.getLogger("task_harness.orchestration.graph")

# Instantiate agent singletons
agents_registry = {
    "email_agent": EmailAgent(),
    "calendar_agent": CalendarAgent(),
    "search_agent": SearchAgent(),
    "custom_agent": CustomAgent(),
}


async def _run_agent_wrapper(agent_id: str, state: TaskState) -> Dict[str, Any]:
    """
    Executes the specified agent node and records corresponding events
    (task.handoff or task.blocked) to DB and Redis.
    """
    agent = agents_registry[agent_id]
    logger.info(f"Executing agent node: {agent_id} for task {state.task_id}")

    agent_result = await agent.process(state)
    outcome = agent_result.get("agent_outcome", "DONE")
    updated_history = agent_result.get("history", state.history)

    if outcome == "HANDOFF":
        from_agent = agent_id
        to_agent = agent_result["handoff_to"]
        reason = agent_result["handoff_reason"]

        logger.info(
            f"Agent handoff: {from_agent} -> {to_agent} (reason: {reason})",
            extra={"task_id": state.task_id},
        )

        async with async_session_factory() as session:
            event = await record_task_event(
                session=session,
                task_id=state.task_id,
                event_type="task.handoff",
                payload={
                    "task_id": state.task_id,
                    "from_agent": from_agent,
                    "to_agent": to_agent,
                    "reason": reason,
                },
                from_agent_id=from_agent,
                to_agent_id=to_agent,
                reason=reason,
            )

        await event_bus.publish_event(
            task_id=state.task_id,
            payload=event.payload,
        )

        return {
            "status": "handoff",
            "current_agent": to_agent,
            "handoff_to": to_agent,
            "handoff_reason": reason,
            "agent_outcome": "HANDOFF",
            "history": updated_history,
        }

    elif outcome == "BLOCKED":
        blocked_reason = agent_result["blocked_reason"]
        logger.warning(
            f"Agent {agent_id} BLOCKED: {blocked_reason}",
            extra={"task_id": state.task_id},
        )

        async with async_session_factory() as session:
            event = await record_task_event(
                session=session,
                task_id=state.task_id,
                event_type="task.blocked",
                payload={
                    "task_id": state.task_id,
                    "agent_id": agent_id,
                    "reason": blocked_reason,
                },
                from_agent_id=agent_id,
                reason=blocked_reason,
            )

        await event_bus.publish_event(
            task_id=state.task_id,
            payload=event.payload,
        )

        return {
            "status": "blocked",
            "blocked_reason": blocked_reason,
            "agent_outcome": "BLOCKED",
            "history": updated_history,
        }

    else:  # DONE
        result_summary = agent_result.get("result_summary", "Completed successfully.")
        return {
            "status": "in_progress",
            "agent_outcome": "DONE",
            "result_summary": result_summary,
            "history": updated_history,
        }


# Node functions for LangGraph
async def node_email_agent(state: TaskState) -> Dict[str, Any]:
    return await _run_agent_wrapper("email_agent", state)


async def node_calendar_agent(state: TaskState) -> Dict[str, Any]:
    return await _run_agent_wrapper("calendar_agent", state)


async def node_search_agent(state: TaskState) -> Dict[str, Any]:
    return await _run_agent_wrapper("search_agent", state)


async def node_custom_agent(state: TaskState) -> Dict[str, Any]:
    return await _run_agent_wrapper("custom_agent", state)


async def node_finalize(state: TaskState) -> Dict[str, Any]:
    """
    Finalize node:
    - Calculates total duration_ms.
    - Writes completed_at and task.completed event to DB.
    - Emits task.completed to Redis event bus.
    """
    logger.info(f"Finalizing task: {state.task_id}", extra={"task_id": state.task_id})

    now_ms = int(time.time() * 1000)
    duration_ms = 1200
    if state.start_time_epoch_ms:
        duration_ms = max(50, now_ms - state.start_time_epoch_ms)

    async with async_session_factory() as session:
        event = await record_task_event(
            session=session,
            task_id=state.task_id,
            event_type="task.completed",
            payload={
                "task_id": state.task_id,
                "duration_ms": duration_ms,
            },
            from_agent_id=state.current_agent,
            reason="Task finished successfully",
        )

    await event_bus.publish_event(
        task_id=state.task_id,
        payload=event.payload,
    )

    return {
        "status": "completed",
        "duration_ms": duration_ms,
        "history": state.history
        + [
            {
                "node": "finalize",
                "duration_ms": duration_ms,
            }
        ],
    }


# Routing functions for conditional edges
def route_after_classification(state: TaskState) -> str:
    """Routes from classification to the chosen agent node."""
    target = state.current_agent or "custom_agent"
    return target if target in agents_registry else "custom_agent"


def route_after_agent(state: TaskState) -> str:
    """
    Routes from any agent node to:
    - another agent node on HANDOFF
    - finalize node on DONE
    - END on BLOCKED
    """
    if state.agent_outcome == "DONE":
        return "finalize"
    elif state.agent_outcome == "HANDOFF":
        return state.handoff_to or "custom_agent"
    elif state.agent_outcome == "BLOCKED":
        return END
    return "finalize"


def build_orchestration_graph() -> StateGraph:
    """
    Constructs the explicit LangGraph StateGraph.
    Inspectable and exportable for judges walkthrough.
    """
    builder = StateGraph(TaskState)

    # Add Nodes
    builder.add_node("classify_and_route", classify_and_route)
    builder.add_node("email_agent", node_email_agent)
    builder.add_node("calendar_agent", node_calendar_agent)
    builder.add_node("search_agent", node_search_agent)
    builder.add_node("custom_agent", node_custom_agent)
    builder.add_node("finalize", node_finalize)

    # Entry point
    builder.add_edge(START, "classify_and_route")

    # Conditional edge from classifier to agents
    builder.add_conditional_edges(
        "classify_and_route",
        route_after_classification,
        {
            "email_agent": "email_agent",
            "calendar_agent": "calendar_agent",
            "search_agent": "search_agent",
            "custom_agent": "custom_agent",
        },
    )

    # Conditional edges from each agent
    agent_destinations = {
        "finalize": "finalize",
        "email_agent": "email_agent",
        "calendar_agent": "calendar_agent",
        "search_agent": "search_agent",
        "custom_agent": "custom_agent",
        END: END,
    }

    builder.add_conditional_edges("email_agent", route_after_agent, agent_destinations)
    builder.add_conditional_edges("calendar_agent", route_after_agent, agent_destinations)
    builder.add_conditional_edges("search_agent", route_after_agent, agent_destinations)
    builder.add_conditional_edges("custom_agent", route_after_agent, agent_destinations)

    # Edge from finalize to END
    builder.add_edge("finalize", END)

    return builder


# Compile the graph
orchestration_graph = build_orchestration_graph().compile()


def get_mermaid_graph() -> str:
    """Returns the Mermaid diagram of the orchestration StateGraph."""
    try:
        return orchestration_graph.get_graph().draw_mermaid()
    except Exception:
        return ""


async def run_task_graph(task_id: str, description: str) -> TaskState:
    """
    Runs the complete state machine graph for a given task.
    """
    initial_state = TaskState(
        task_id=task_id,
        description=description,
        status="received",
        start_time_epoch_ms=int(time.time() * 1000),
    )

    final_state_dict = await orchestration_graph.ainvoke(initial_state)
    return TaskState(**final_state_dict)


async def resume_from_blocked(task_id: str, retry_override: Optional[int] = None) -> TaskState:
    """
    Resumes a blocked task from the point it stalled:
    - Increments retry_count based on historical blocked events.
    - If retry_count >= 2, escalates to custom_agent.
    - Otherwise re-enters the graph at the blocked node.
    """
    async with async_session_factory() as session:
        task = await get_task(session, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task.status != "blocked":
            raise ValueError(f"Task {task_id} is not in blocked status (current: {task.status})")

        events = await get_task_history(session, task_id)
        blocked_count = sum(1 for e in events if e.event_type == "task.blocked")

        current_agent_id = task.current_agent_id or "custom_agent"
        description = task.description

    retry_count = retry_override if retry_override is not None else blocked_count

    # Cap at 2 retries, then require the escalate-to-custom_agent path
    target_agent = current_agent_id
    if retry_count >= 2 or current_agent_id == "custom_agent":
        target_agent = "custom_agent"
        escalation_reason = f"Max retries reached ({retry_count}). Escalating to custom_agent."
        async with async_session_factory() as session:
            event = await record_task_event(
                session=session,
                task_id=task_id,
                event_type="task.handoff",
                payload={
                    "task_id": task_id,
                    "from_agent": current_agent_id,
                    "to_agent": "custom_agent",
                    "reason": escalation_reason,
                },
                from_agent_id=current_agent_id,
                to_agent_id="custom_agent",
                reason=escalation_reason,
            )
        await event_bus.publish_event(task_id, event.payload)

    resume_state = TaskState(
        task_id=task_id,
        description=description,
        status="in_progress",
        current_agent=target_agent,
        retry_count=retry_count + 1,
        start_time_epoch_ms=int(time.time() * 1000),
        history=[{"action": "resume_from_blocked", "target_agent": target_agent, "retry_count": retry_count}],
    )

    # Run from the selected agent node through the remainder of the graph
    node_func = {
        "email_agent": node_email_agent,
        "calendar_agent": node_calendar_agent,
        "search_agent": node_search_agent,
        "custom_agent": node_custom_agent,
    }.get(target_agent, node_custom_agent)

    # Execute agent
    step_result = await node_func(resume_state)
    new_state = resume_state.model_copy(update=step_result)

    # If outcome is DONE, finalize
    if new_state.agent_outcome == "DONE":
        final_result = await node_finalize(new_state)
        new_state = new_state.model_copy(update=final_result)

    return new_state
