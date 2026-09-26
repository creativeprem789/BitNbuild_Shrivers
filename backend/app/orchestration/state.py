from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

TaskStatus = Literal[
    "received",
    "routed",
    "in_progress",
    "blocked",
    "handoff",
    "completed",
]

AgentOutcome = Literal["DONE", "HANDOFF", "BLOCKED"]


class TaskState(BaseModel):
    """
    Shared graph state for LangGraph task orchestration.
    Maintains complete execution context, history, and handoff chain.
    """
    task_id: str
    description: str
    status: TaskStatus = "received"
    current_agent: Optional[str] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)
    retry_count: int = 0
    blocked_reason: Optional[str] = None

    # Handoff and routing tracking
    route_confidence: Optional[float] = None
    route_reason: Optional[str] = None
    handoff_to: Optional[str] = None
    handoff_reason: Optional[str] = None
    agent_outcome: Optional[AgentOutcome] = None

    # Timing metrics
    start_time_epoch_ms: Optional[int] = None
    duration_ms: Optional[int] = None
    result_summary: Optional[str] = None
