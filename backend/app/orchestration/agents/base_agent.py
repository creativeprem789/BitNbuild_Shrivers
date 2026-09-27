from abc import ABC, abstractmethod
from typing import Any, Dict
import time
from app.orchestration.state import TaskState


class BaseAgent(ABC):
    """
    Abstract base class for all specialized virtual office agents.
    Every agent must return an outcome:
      - 'DONE': Task successfully completed by this agent
      - 'HANDOFF': Handing off to another specialized agent (with explicit reason)
      - 'BLOCKED': Cannot proceed (requires user input/clarification or retry)
    """

    def __init__(self, agent_id: str, display_name: str, role: str):
        self.agent_id = agent_id
        self.display_name = display_name
        self.role = role

    async def emit_step(self, task_id: str, label: str, detail: str) -> None:
        from app.events.event_bus import event_bus
        payload = {
            "event_type": "task.step",
            "task_id": task_id,
            "agent_id": self.agent_id,
            "label": label,
            "detail": detail,
            "sequence_no": int(time.time() * 1000) # Use timestamp for sequence to ensure monotonic
        }
        await event_bus.publish_event(task_id, payload)

    @abstractmethod
    async def process(self, state: TaskState) -> Dict[str, Any]:
        """
        Process the task state and return state updates.
        Returns dict containing:
          - agent_outcome: 'DONE' | 'HANDOFF' | 'BLOCKED'
          - handoff_to: Optional[str]
          - handoff_reason: Optional[str]
          - blocked_reason: Optional[str]
          - result_summary: Optional[str]
          - history: List[dict] (appended entry)
        """
        pass
