from abc import ABC, abstractmethod
from typing import Any, Dict
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
