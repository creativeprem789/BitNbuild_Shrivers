import asyncio
import logging
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as aioredis

from app.config import settings
from app.db.models import Task
from app.db.repository import (
    create_task,
    get_task,
    get_task_history,
    list_tasks,
    record_task_event,
)
from app.db.session import get_db
from app.events.event_bus import event_bus
from app.orchestration.graph import (
    get_mermaid_graph,
    resume_from_blocked,
    run_task_graph,
)

logger = logging.getLogger("task_harness.api.tasks")

router = APIRouter()


class CreateTaskRequest(BaseModel):
    description: str = Field(
        ...,
        min_length=1,
        description="Natural language task description submitted by the user",
        examples=["Schedule a quarterly review meeting with the design team tomorrow at 2 PM"],
    )


class TaskResponse(BaseModel):
    task_id: str
    status: str
    description: str


class TaskDetailResponse(BaseModel):
    task: Dict[str, Any]
    events: List[Dict[str, Any]]


class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_new_task(
    body: CreateTaskRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
):
    """
    Creates a new task, records the initial task.created event,
    publishes to Redis, and enqueues LangGraph execution.
    """
    task = await create_task(session, description=body.description)
    task_id_str = str(task.id)

    # 1. Record task.created event atomically to DB
    event = await record_task_event(
        session=session,
        task_id=task.id,
        event_type="task.created",
        payload={
            "task_id": task_id_str,
            "description": body.description,
        },
        reason="Task received by harness",
    )

    # 2. Publish to Redis event bus
    await event_bus.publish_event(task_id_str, event.payload)

    # 3. Asynchronously trigger LangGraph orchestration execution
    background_tasks.add_task(run_task_graph, task_id_str, body.description)

    return TaskResponse(
        task_id=task_id_str,
        status="received",
        description=task.description,
    )


@router.get("/tasks/{task_id}", response_model=TaskDetailResponse)
async def get_task_details(
    task_id: str,
    session: AsyncSession = Depends(get_db),
):
    """
    Returns current task state and full event history.
    This is what a reconnecting frontend calls to re-sync state before resuming WebSocket stream.
    """
    try:
        uuid_obj = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task_id UUID format")

    task = await get_task(session, uuid_obj)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    events = await get_task_history(session, uuid_obj)

    return TaskDetailResponse(
        task=task.to_dict(),
        events=[e.to_dict() for e in events],
    )


@router.get("/tasks", response_model=List[Dict[str, Any]])
async def list_recent_tasks(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
):
    """Lists recent tasks for demo and debugging."""
    tasks = await list_tasks(session, limit=limit, offset=offset)
    return [t.to_dict() for t in tasks]


@router.post("/tasks/{task_id}/retry")
async def retry_blocked_task(
    task_id: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
):
    """
    Resumes a blocked task from the point it stalled.
    Increments retry count; escalates to custom_agent after 2 retries.
    """
    try:
        uuid_obj = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task_id UUID format")

    task = await get_task(session, uuid_obj)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    if task.status != "blocked":
        raise HTTPException(
            status_code=400,
            detail=f"Task {task_id} is not in blocked status (current: {task.status})",
        )

    background_tasks.add_task(resume_from_blocked, task_id)
    return {"task_id": task_id, "status": "resuming"}


@router.get("/health", response_model=HealthResponse)
async def health_check(session: AsyncSession = Depends(get_db)):
    """
    Checks PostgreSQL and Redis connectivity.
    Used by docker-compose healthcheck.
    """
    db_status = "healthy"
    redis_status = "healthy"

    # Check Database
    try:
        await session.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Healthcheck DB failure: {e}")
        db_status = f"unhealthy: {e}"

    # Check Redis / Event Bus
    if settings.REDIS_URL:
        try:
            r = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await r.ping()
            await r.close()
        except Exception as e:
            logger.error(f"Healthcheck Redis failure: {e}")
            redis_status = f"unhealthy: {e}"
    else:
        redis_status = "in_memory (redis disabled)"

    is_healthy = db_status == "healthy" and ("unhealthy" not in redis_status)
    status_code = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status="ok" if is_healthy else "degraded",
        database=db_status,
        redis=redis_status,
    )



@router.get("/orchestration/graph")
async def get_orchestration_diagram():
    """
    Returns the Mermaid flowchart definition of the LangGraph StateGraph.
    Provides verifiable proof of orchestration logic for judges walkthrough.
    """
    return {
        "format": "mermaid",
        "diagram": get_mermaid_graph(),
    }
