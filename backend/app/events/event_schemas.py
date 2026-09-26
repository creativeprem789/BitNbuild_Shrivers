"""
Pydantic event models matching the exact frontend contract for the virtual office.

Contract:
  task.created   { task_id, description, sequence_no }
  task.routed    { task_id, agent_id, confidence, reason, sequence_no }
  task.handoff   { task_id, from_agent, to_agent, reason, sequence_no }
  task.blocked   { task_id, agent_id, reason, sequence_no }
  task.completed { task_id, duration_ms, sequence_no }
"""

from enum import Enum
from typing import Any, Union
from pydantic import BaseModel, Field


class EventType(str, Enum):
    TASK_CREATED = "task.created"
    TASK_ROUTED = "task.routed"
    TASK_HANDOFF = "task.handoff"
    TASK_BLOCKED = "task.blocked"
    TASK_COMPLETED = "task.completed"


class BaseTaskEvent(BaseModel):
    event_type: str
    event: str = ""
    task_id: str
    sequence_no: int

    def model_post_init(self, __context: Any) -> None:
        if not self.event:
            self.event = self.event_type


class TaskCreatedPayload(BaseTaskEvent):
    event_type: str = EventType.TASK_CREATED.value
    description: str


class TaskRoutedPayload(BaseTaskEvent):
    event_type: str = EventType.TASK_ROUTED.value
    agent_id: str
    confidence: float
    reason: str


class TaskHandoffPayload(BaseTaskEvent):
    event_type: str = EventType.TASK_HANDOFF.value
    from_agent: str
    to_agent: str
    reason: str


class TaskBlockedPayload(BaseTaskEvent):
    event_type: str = EventType.TASK_BLOCKED.value
    agent_id: str
    reason: str


class TaskCompletedPayload(BaseTaskEvent):
    event_type: str = EventType.TASK_COMPLETED.value
    duration_ms: int


TaskEventPayload = Union[
    TaskCreatedPayload,
    TaskRoutedPayload,
    TaskHandoffPayload,
    TaskBlockedPayload,
    TaskCompletedPayload,
]
