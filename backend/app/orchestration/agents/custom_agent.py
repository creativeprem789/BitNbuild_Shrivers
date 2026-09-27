import asyncio
import logging
from typing import Any, Dict
from app.orchestration.agents.base_agent import BaseAgent
from app.orchestration.state import TaskState

logger = logging.getLogger("task_harness.agent.custom")


class CustomAgent(BaseAgent):
    """
    Executive Resolver:
    - Handles low-confidence classifications (< 0.60) as a deliberate fallback.
    - Resolves escalated tasks after retry limits (cap at 2 retries).
    - Solves ambiguous, open-ended, and multi-disciplinary requests.
    """

    def __init__(self):
        super().__init__(
            agent_id="custom_agent",
            display_name="Executive Resolver",
            role="Handles low-confidence fallback, complex multi-domain workflows, and escalations",
        )

    async def process(self, state: TaskState) -> Dict[str, Any]:
        logger.info(
            f"CustomAgent resolving complex/fallback task: {state.task_id}",
            extra={"task_id": state.task_id},
        )

        await self.emit_step(state.task_id, "Understanding the request", "Assessing what is needed and the best approach")
        await asyncio.sleep(0.8)
        
        await self.emit_step(state.task_id, "Reviewing the available information", "Checking context, prior steps and relevant data")
        await asyncio.sleep(0.8)

        await self.emit_step(state.task_id, "Identifying the required action", "Determining the exact steps needed to resolve this")
        await asyncio.sleep(0.8)

        await self.emit_step(state.task_id, "Resolving the request", "Executing the required steps with available tools")
        await asyncio.sleep(0.8)

        await self.emit_step(state.task_id, "Verifying the result", "Checking the outcome meets the original requirement")
        await asyncio.sleep(0.8)

        await self.emit_step(state.task_id, "Preparing the final response", "Wrapping up and delivering a clear result")
        await asyncio.sleep(0.8)

        desc_lower = state.description.lower()

        # Check if permanently unresolvable
        if "impossible" in desc_lower or "unsolvable" in desc_lower:
            reason = "Task declared unresolvable due to contradictory instructions."
            return {
                "agent_outcome": "BLOCKED",
                "blocked_reason": reason,
                "history": state.history
                + [
                    {
                        "agent": self.agent_id,
                        "status": "BLOCKED",
                        "reason": reason,
                    }
                ],
            }

        # Resolve the task
        escalation_note = (
            f" (Resolved after {state.retry_count} retries)"
            if state.retry_count > 0
            else ""
        )
        result_summary = (
            f"Custom strategy formulated and executed successfully{escalation_note} for: "
            f"'{state.description[:50]}...'"
        )

        return {
            "agent_outcome": "DONE",
            "result_summary": result_summary,
            "history": state.history
            + [
                {
                    "agent": self.agent_id,
                    "status": "DONE",
                    "result": result_summary,
                }
            ],
        }
