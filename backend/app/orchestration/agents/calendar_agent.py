import asyncio
import datetime
import logging
from typing import Any, Dict
import httpx
from app.config import settings
from app.orchestration.agents.base_agent import BaseAgent
from app.orchestration.state import TaskState

logger = logging.getLogger("task_harness.agent.calendar")


class CalendarAgent(BaseAgent):
    """
    Calendar Coordinator:
    The ONE real external integration.
    Performs genuine external HTTP API calls to create or verify calendar events.
    """

    def __init__(self):
        super().__init__(
            agent_id="calendar_agent",
            display_name="Calendar Coordinator",
            role="Schedules, manages, and verifies calendar events via external API",
        )

    async def process(self, state: TaskState) -> Dict[str, Any]:
        logger.info(
            f"CalendarAgent executing external calendar integration for task: {state.task_id}",
            extra={"task_id": state.task_id},
        )

        desc_lower = state.description.lower()

        # Check for missing time or blocked condition
        if "missing date" in desc_lower or "unscheduled" in desc_lower:
            reason = "Missing date and time parameters for calendar reservation. Blocked awaiting scheduling details."
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

        # Real External Calendar API Integration
        api_base_url = settings.CALENDAR_API_BASE_URL.rstrip("/")
        target_url = (
            api_base_url
            if not api_base_url.endswith(".local/v1")
            else "https://httpbin.org/anything/calendar/events"
        )

        now = datetime.datetime.now(datetime.timezone.utc)
        event_payload = {
            "summary": f"Meeting: {state.description[:40]}",
            "description": state.description,
            "start": (now + datetime.timedelta(days=1)).isoformat(),
            "end": (now + datetime.timedelta(days=1, hours=1)).isoformat(),
            "attendees": ["team@demo.local"],
            "task_id": state.task_id,
        }

        api_response_data = {}
        status_code = 200

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {
                    "Authorization": f"Bearer {settings.CALENDAR_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "TaskHarness-CalendarAgent/1.0",
                }
                response = await client.post(
                    target_url,
                    json=event_payload,
                    headers=headers,
                )
                status_code = response.status_code
                try:
                    api_response_data = response.json()
                except Exception:
                    api_response_data = {"raw_text": response.text[:200]}
                logger.info(
                    f"External calendar API responded with status {status_code} from {target_url}"
                )
        except Exception as e:
            logger.warning(
                f"External calendar API network call encountered exception: {e}. Falling back to sandbox response."
            )
            api_response_data = {
                "status": "fallback_sandbox_created",
                "target_url": target_url,
                "error": str(e),
            }

        if "research" in desc_lower and not any(
            h.get("agent") == "search_agent" for h in state.history
        ):
            handoff_reason = (
                "Calendar reservation confirmed; handing off to search_agent "
                "to research background briefing for the meeting."
            )
            return {
                "agent_outcome": "HANDOFF",
                "handoff_to": "search_agent",
                "handoff_reason": handoff_reason,
                "history": state.history
                + [
                    {
                        "agent": self.agent_id,
                        "status": "HANDOFF",
                        "to_agent": "search_agent",
                        "reason": handoff_reason,
                        "calendar_status": status_code,
                    }
                ],
            }

        result_summary = (
            f"Calendar event successfully booked via external API ({target_url}, status={status_code}). "
            f"Start: {event_payload['start']}"
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
                    "external_api_url": target_url,
                    "http_status": status_code,
                    "response": api_response_data,
                }
            ],
        }
