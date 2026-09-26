import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Task, TaskEvent, Agent
import logging

logger = logging.getLogger("task_harness.repository")


def _to_uuid(val: Any) -> uuid.UUID:
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


async def create_task(
    session: AsyncSession, description: str, task_id: Optional[uuid.UUID | str] = None
) -> Task:
    """Creates a new task in the database."""
    tid = _to_uuid(task_id) if task_id else uuid.uuid4()
    task = Task(
        id=tid,
        description=description,
        status="received",
        created_at=datetime.now(timezone.utc),
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    logger.info(f"Task created: {task.id}", extra={"task_id": str(task.id)})
    return task


async def get_task(
    session: AsyncSession, task_id: uuid.UUID | str
) -> Optional[Task]:
    """Retrieves a task by ID."""
    tid = _to_uuid(task_id)
    result = await session.execute(select(Task).where(Task.id == tid))
    return result.scalar_one_or_none()


async def list_tasks(
    session: AsyncSession, limit: int = 50, offset: int = 0
) -> List[Task]:
    """Lists recent tasks ordered by creation time descending."""
    result = await session.execute(
        select(Task).order_by(desc(Task.created_at)).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def record_task_event(
    session: AsyncSession,
    task_id: uuid.UUID | str,
    event_type: str,
    payload: Dict[str, Any],
    from_agent_id: Optional[str] = None,
    to_agent_id: Optional[str] = None,
    reason: Optional[str] = None,
) -> TaskEvent:
    """
    Atomically writes a task_events row and updates task state.
    Uses SELECT ... FOR UPDATE on PostgreSQL to lock the task row and guarantee
    strictly monotonic sequence numbers without concurrency race conditions.
    """
    tid = _to_uuid(task_id)

    # Lock task row on databases that support FOR UPDATE (PostgreSQL)
    bind = session.get_bind()
    dialect_name = bind.dialect.name if bind else "postgresql"
    query = select(Task).where(Task.id == tid)
    if dialect_name == "postgresql":
        query = query.with_for_update()

    task_res = await session.execute(query)
    task = task_res.scalar_one_or_none()
    if not task:
        raise ValueError(f"Task {task_id} not found in database")

    # Atomically calculate next monotonic sequence number
    seq_res = await session.execute(
        select(func.coalesce(func.max(TaskEvent.sequence_no), 0)).where(
            TaskEvent.task_id == tid
        )
    )
    next_seq = (seq_res.scalar_one() or 0) + 1

    # Inject sequence_no into payload for full event fidelity
    event_payload = dict(payload)
    event_payload["sequence_no"] = next_seq
    event_payload["task_id"] = str(tid)
    if "event_type" not in event_payload:
        event_payload["event_type"] = event_type
    if "event" not in event_payload:
        event_payload["event"] = event_type

    # Update Task state based on event type
    if event_type == "task.created":
        task.status = "received"
    elif event_type == "task.routed":
        task.status = "routed"
        if to_agent_id:
            task.current_agent_id = to_agent_id
    elif event_type == "task.handoff":
        task.status = "handoff"
        if to_agent_id:
            task.current_agent_id = to_agent_id
    elif event_type == "task.blocked":
        task.status = "blocked"
    elif event_type == "task.completed":
        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)
        if "duration_ms" in event_payload:
            task.duration_ms = event_payload["duration_ms"]
        elif task.created_at:
            delta = task.completed_at - task.created_at
            task.duration_ms = int(delta.total_seconds() * 1000)
            event_payload["duration_ms"] = task.duration_ms

    event = TaskEvent(
        task_id=tid,
        sequence_no=next_seq,
        event_type=event_type,
        from_agent_id=from_agent_id,
        to_agent_id=to_agent_id,
        reason=reason,
        payload=event_payload,
        created_at=datetime.now(timezone.utc),
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    await session.refresh(task)

    logger.info(
        f"Event recorded: {event_type} (seq={next_seq}) for task {task_id}",
        extra={"task_id": str(task_id)},
    )
    return event


async def get_task_history(
    session: AsyncSession, task_id: uuid.UUID | str
) -> List[TaskEvent]:
    """
    Returns the full ordered event list for a task.
    Powers the sidebar timeline and reconnecting client state re-sync.
    """
    tid = _to_uuid(task_id)
    result = await session.execute(
        select(TaskEvent)
        .where(TaskEvent.task_id == tid)
        .order_by(TaskEvent.sequence_no.asc())
    )
    return list(result.scalars().all())


async def list_agents(session: AsyncSession) -> List[Agent]:
    """Retrieves all registered agents."""
    result = await session.execute(select(Agent).where(Agent.is_active.is_(True)))
    return list(result.scalars().all())
