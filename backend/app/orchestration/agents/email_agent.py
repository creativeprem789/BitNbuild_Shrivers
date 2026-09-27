import asyncio
import logging
from typing import Any, Dict
from app.config import settings
from app.orchestration.agents.base_agent import BaseAgent
from app.orchestration.state import TaskState

logger = logging.getLogger("task_harness.agent.email")


class EmailAgent(BaseAgent):
    """
    Email Specialist:
    - Triages, drafts, and handles communication requests.
    - Features realistic ~1-2s simulated execution delay.
    - Recognizes cross-domain workflows (e.g. scheduling calendar invites) and
      triggers explicit handoff to calendar_agent.
    """

    def __init__(self):
        super().__init__(
            agent_id="email_agent",
            display_name="Email Specialist",
            role="Drafts, triages, and prepares email communications",
        )

    async def process(self, state: TaskState) -> Dict[str, Any]:
        logger.info(
            f"EmailAgent processing task: {state.task_id}",
            extra={"task_id": state.task_id},
        )

        await self.emit_step(state.task_id, "Understanding the email request", "Reading what you need and identifying who to contact")
        await asyncio.sleep(0.8)
        
        await self.emit_step(state.task_id, "Preparing the recipient details", "Gathering email addresses and contact information")
        await asyncio.sleep(0.8)
        
        await self.emit_step(state.task_id, "Choosing an appropriate subject", "Selecting a clear, relevant subject line")
        await asyncio.sleep(0.8)
        
        await self.emit_step(state.task_id, "Writing the email content", "Composing the body text with the right tone and detail")
        await asyncio.sleep(0.8)
        
        await self.emit_step(state.task_id, "Reviewing the message", "Checking for accuracy, tone and completeness")
        await asyncio.sleep(0.8)
        
        await self.emit_step(state.task_id, "Sending the email", "Delivering the message to the intended recipient(s)")
        await asyncio.sleep(0.8)

        desc_lower = state.description.lower()

        # Check for blocked condition (e.g. missing recipient or explicit block testing)
        if "recipient missing" in desc_lower or "missing email" in desc_lower:
            reason = "Recipient email address not provided. Blocked awaiting contact information."
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

        # Check for handoff condition: scheduling / calendar involvement
        calendar_keywords = ["schedule", "meeting", "calendar", "invite", "appointment"]
        if any(kw in desc_lower for kw in calendar_keywords) and not any(
            h.get("agent") == "calendar_agent" for h in state.history
        ):
            handoff_reason = (
                "Drafted initial email response; handing off to calendar_agent "
                "to reserve the time slot and confirm scheduling."
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
                        "draft": f"Subject: Follow-up regarding: {state.description[:40]}...",
                    }
                ],
            }

        # Otherwise successfully complete task
        result = (
            f"Email composed and queued for delivery. Summary: Handled '{state.description[:50]}'"
        )
        return {
            "agent_outcome": "DONE",
            "result_summary": result,
            "history": state.history
            + [
                {
                    "agent": self.agent_id,
                    "status": "DONE",
                    "result": result,
                }
            ],
        }
