import asyncio
import logging
from typing import Any, Dict
from app.orchestration.agents.base_agent import BaseAgent
from app.orchestration.state import TaskState

logger = logging.getLogger("task_harness.agent.search")


class SearchAgent(BaseAgent):
    """
    Research Analyst:
    - Investigates queries, gathers information, and produces synthesis.
    - Features realistic ~1-2s simulated execution delay.
    - Hands off to email_agent or custom_agent when synthesis requires distribution.
    """

    def __init__(self):
        super().__init__(
            agent_id="search_agent",
            display_name="Research Analyst",
            role="Investigates queries, gathers external data, and summarizes findings",
        )

    async def process(self, state: TaskState) -> Dict[str, Any]:
        logger.info(
            f"SearchAgent researching task: {state.task_id}",
            extra={"task_id": state.task_id},
        )

        # Realistic execution delay
        await asyncio.sleep(1.2)

        desc_lower = state.description.lower()

        # Blocked condition check
        if "paywall" in desc_lower or "credentials needed" in desc_lower:
            reason = "Requested research data source is behind an unauthorized paywall. Blocked awaiting credentials."
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

        # Handoff condition check: If results need to be emailed or reported to stakeholders
        email_keywords = [
            "email", "send", "notify", "forward", "report", "brief", "share",
            "vp", "executive", "lead", "manager", "stakeholder", "client", "team",
            "present to", "deliver", "message", "write to", "inform", "reach out"
        ]
        if any(kw in desc_lower for kw in email_keywords) and not any(
            h.get("agent") == "email_agent" for h in state.history
        ):
            handoff_reason = (
                "Research synthesis complete; handing off to email_agent "
                "to compose briefing and deliver report to stakeholders."
            )
            return {
                "agent_outcome": "HANDOFF",
                "handoff_to": "email_agent",
                "handoff_reason": handoff_reason,
                "history": state.history
                + [
                    {
                        "agent": self.agent_id,
                        "status": "HANDOFF",
                        "to_agent": "email_agent",
                        "reason": handoff_reason,
                        "research_data": f"Findings compiled for: {state.description}",
                    }
                ],
            }

        # Handoff condition check: If results need to be presented in a scheduled meeting
        cal_keywords = ["calendar", "schedule", "meeting", "appointment", "book"]
        if any(kw in desc_lower for kw in cal_keywords) and not any(
            h.get("agent") == "calendar_agent" for h in state.history
        ):
            handoff_reason = (
                "Research synthesis complete; handing off to calendar_agent "
                "to schedule team meeting to review findings."
            )
            return {
                "agent_outcome": "HANDOFF",
                "handoff_to": "calendar_agent",
                "handoff_reason": handoff_reason,
                "history": state.history
                + [
                    {
                        "agent": self.agent_id,
                        "status": "HANDOFF",
                        "to_agent": "calendar_agent",
                        "reason": handoff_reason,
                        "research_data": f"Findings compiled for: {state.description}",
                    }
                ],
            }

        result_summary = (
            f"Research complete: Analyzed key data points for '{state.description[:45]}...'. "
            "Report compiled with verified references."
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
